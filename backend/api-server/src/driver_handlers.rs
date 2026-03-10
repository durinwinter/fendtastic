use crate::authority_service;
use crate::driver_backend::{self, DriverBackend};
use crate::neuron_client::NeuronHttpClient;
use crate::runtime_store;
use crate::state::AppState;
use std::sync::Arc;
use actix_web::{web, HttpResponse, Responder};
use serde_json::Value;
use shared::domain::authority::{ActorClass, AuthorityState};
use shared::domain::driver::{
    DriverDataType, DriverInstance, DriverInstanceState, DriverOperationRecord, DriverStatusSnapshot,
    DriverTag, TagAccess, TagGroup,
};
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct CreateDriverRequest {
    pub runtime_node_id: String,
    pub pea_id: String,
    pub driver_key: String,
    pub display_name: String,
    pub config: serde_json::Value,
    pub tag_groups: Option<Vec<TagGroup>>,
}

#[derive(serde::Deserialize)]
pub struct DriverSchemaQuery {
    pub runtime_node_id: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct UpdateDriverRequest {
    pub display_name: Option<String>,
    pub config: Option<serde_json::Value>,
    pub tag_groups: Option<Vec<TagGroup>>,
    pub state: Option<DriverInstanceState>,
    pub last_error: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct ReadTagRequest {
    pub tag_id: String,
}

#[derive(serde::Deserialize)]
pub struct WriteTagRequest {
    pub tag_id: String,
    pub value: serde_json::Value,
    pub pea_id: String,
    pub actor_id: String,
    pub actor_class: ActorClass,
}

#[derive(serde::Serialize)]
pub struct DriverBrowseResponse {
    pub driver_id: String,
    pub groups: Vec<DriverBrowseGroup>,
}

#[derive(serde::Serialize)]
pub struct DriverBrowseGroup {
    pub name: String,
    pub interval: Option<u64>,
    pub tags: Vec<DriverBrowseTag>,
}

#[derive(serde::Serialize)]
pub struct DriverBrowseTag {
    pub name: String,
    pub address: String,
    pub data_type: DriverDataType,
    pub access: TagAccess,
    pub description: Option<String>,
}

async fn resolve_backend_for_driver(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
) -> Result<Arc<dyn DriverBackend>, HttpResponse> {
    let runtime_node = {
        let nodes = state.runtime_nodes.read().await;
        nodes.get(&driver.runtime_node_id).cloned()
    };
    driver_backend::resolve_backend(driver, runtime_node.as_ref(), &state.native_s7_registry)
        .map_err(|e| HttpResponse::BadRequest().json(serde_json::json!({"error": e.to_string()})))
}

pub async fn get_driver_catalog(state: web::Data<AppState>) -> impl Responder {
    let catalog = state.driver_catalog.read().await;
    HttpResponse::Ok().json(catalog.clone())
}

pub async fn get_driver_schema(
    state: web::Data<AppState>,
    driver_key: web::Path<String>,
    query: web::Query<DriverSchemaQuery>,
) -> impl Responder {
    let catalog_entry = {
        let catalog = state.driver_catalog.read().await;
        match catalog.iter().find(|entry| entry.key == driver_key.as_str()) {
            Some(entry) => entry.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver key not found"}))
            }
        }
    };

    // Only fetch remote schema for Neuron-backed drivers
    if catalog_entry.vendor == "Neuron" {
        if let Some(runtime_node_id) = &query.runtime_node_id {
            let runtime_node = {
                let runtime_nodes = state.runtime_nodes.read().await;
                runtime_nodes.get(runtime_node_id).cloned()
            };
            if let Some(runtime_node) = runtime_node {
                let client = NeuronHttpClient::new();
                match client.get_driver_schema(&runtime_node.neuron, driver_key.as_str()).await {
                    Ok(config_schema) => {
                        return HttpResponse::Ok().json(serde_json::json!({
                            "key": catalog_entry.key,
                            "name": catalog_entry.name,
                            "vendor": catalog_entry.vendor,
                            "direction": catalog_entry.direction,
                            "config_schema": config_schema,
                            "tag_schema": catalog_entry.tag_schema,
                            "source": "neuron",
                        }))
                    }
                    Err(_) => {}
                }
            }
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "key": catalog_entry.key,
        "name": catalog_entry.name,
        "vendor": catalog_entry.vendor,
        "direction": catalog_entry.direction,
        "config_schema": catalog_entry.config_schema,
        "tag_schema": catalog_entry.tag_schema,
        "source": "builtin",
    }))
}

pub async fn list_drivers(state: web::Data<AppState>) -> impl Responder {
    let drivers = state.driver_instances.read().await;
    let list: Vec<DriverInstance> = drivers.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn get_driver_status(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let driver = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };

    let mut snapshot = current_driver_status(&state, &driver).await;
    if let Ok(backend) = resolve_backend_for_driver(&state, &driver).await {
        if let Ok(Some(remote_state)) = backend.get_driver_state(&driver).await {
            snapshot.remote_running = Some(remote_state.running);
            snapshot.remote_link = remote_state.link;
            snapshot.remote_rtt = remote_state.rtt;
            snapshot.updated_at = chrono::Utc::now();
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
            publish_driver_status(&state, &driver, &snapshot).await;
        }
    }

    HttpResponse::Ok().json(snapshot)
}

pub async fn browse_driver_tags(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let driver = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };
    let backend = match resolve_backend_for_driver(&state, &driver).await {
        Ok(b) => b,
        Err(response) => return response,
    };

    match backend.browse_tags(&driver).await {
        Ok(groups) => HttpResponse::Ok().json(DriverBrowseResponse {
            driver_id: driver.id,
            groups: groups
                .into_iter()
                .map(|group| DriverBrowseGroup {
                    name: group.name,
                    interval: group.interval,
                    tags: group.tags
                        .into_iter()
                        .map(|tag| DriverBrowseTag {
                            name: tag.name,
                            address: tag.address.unwrap_or_default(),
                            data_type: remote_data_type(tag.data_type),
                            access: remote_tag_access(tag.attribute),
                            description: tag.description,
                        })
                        .collect(),
                })
                .collect(),
        }),
        Err(err) => HttpResponse::BadGateway().json(serde_json::json!({
            "error": err.to_string()
        })),
    }
}

pub async fn create_driver(state: web::Data<AppState>, body: web::Json<CreateDriverRequest>) -> impl Responder {
    let runtime_nodes = state.runtime_nodes.read().await;
    let Some(runtime_node) = runtime_nodes.get(&body.runtime_node_id) else {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Runtime node does not exist"}));
    };
    if runtime_node.assigned_pea_id.as_deref() != Some(body.pea_id.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Runtime node is not assigned to the selected PEA"}));
    }
    drop(runtime_nodes);

    let catalog = state.driver_catalog.read().await;
    if !catalog.iter().any(|entry| entry.key == body.driver_key) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Unknown driver key"}));
    }
    drop(catalog);

    let now = chrono::Utc::now();
    let driver = DriverInstance {
        id: Uuid::new_v4().to_string(),
        runtime_node_id: body.runtime_node_id.clone(),
        pea_id: body.pea_id.clone(),
        driver_key: body.driver_key.clone(),
        display_name: body.display_name.clone(),
        state: DriverInstanceState::Created,
        config: body.config.clone(),
        tag_groups: body
            .tag_groups
            .clone()
            .filter(|groups| !groups.is_empty())
            .unwrap_or_else(|| default_tag_groups(&body.driver_key)),
        last_error: None,
        created_at: now,
        updated_at: now,
    };

    runtime_store::persist_json(&state.driver_dir, &driver.id, &driver);
    state.driver_instances.write().await.insert(driver.id.clone(), driver.clone());
    let snapshot = default_status_snapshot(&driver);
    state
        .driver_statuses
        .write()
        .await
        .insert(driver.id.clone(), snapshot.clone());
    publish_driver_status(&state, &driver, &snapshot).await;
    HttpResponse::Created().json(driver)
}

pub async fn get_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let drivers = state.driver_instances.read().await;
    match drivers.get(id.as_str()) {
        Some(driver) => HttpResponse::Ok().json(driver),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"})),
    }
}

pub async fn update_driver(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<UpdateDriverRequest>) -> impl Responder {
    let driver_snapshot = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };

    let mut updated_driver = driver_snapshot.clone();
    if let Some(name) = &body.display_name { updated_driver.display_name = name.clone(); }
    if let Some(config) = &body.config { updated_driver.config = config.clone(); }
    if let Some(tag_groups) = &body.tag_groups { updated_driver.tag_groups = tag_groups.clone(); }
    if let Some(state_value) = &body.state { updated_driver.state = state_value.clone(); }
    if body.last_error.is_some() { updated_driver.last_error = body.last_error.clone(); }
    updated_driver.updated_at = chrono::Utc::now();

    if matches!(updated_driver.state, DriverInstanceState::Running) {
        if let Ok(backend) = resolve_backend_for_driver(&state, &updated_driver).await {
            if let Err(err) = backend.sync_driver(&updated_driver).await {
                updated_driver.last_error = Some(err.to_string());
                updated_driver.state = DriverInstanceState::Error;
            }
        }
    }

    runtime_store::persist_json(&state.driver_dir, &updated_driver.id, &updated_driver);
    state
        .driver_instances
        .write()
        .await
        .insert(updated_driver.id.clone(), updated_driver.clone());
    let mut snapshot = current_driver_status(&state, &updated_driver).await;
    snapshot.node_name = node_name_for_driver(&updated_driver);
    snapshot.state = updated_driver.state.clone();
    snapshot.last_error = updated_driver.last_error.clone();
    snapshot.updated_at = chrono::Utc::now();
    state
        .driver_statuses
        .write()
        .await
        .insert(updated_driver.id.clone(), snapshot.clone());
    publish_driver_status(&state, &updated_driver, &snapshot).await;
    HttpResponse::Ok().json(updated_driver)
}

pub async fn delete_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut drivers = state.driver_instances.write().await;
    if drivers.remove(id.as_str()).is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    }
    runtime_store::delete_json(&state.driver_dir, id.as_str());
    state.driver_statuses.write().await.remove(id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn start_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let driver_snapshot = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };
    let backend = match resolve_backend_for_driver(&state, &driver_snapshot).await {
        Ok(b) => b,
        Err(response) => return response,
    };

    match backend.start_driver(&driver_snapshot).await {
        Ok(()) => {
            let mut drivers = state.driver_instances.write().await;
            let Some(driver) = drivers.get_mut(id.as_str()) else {
                return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
            };
            driver.state = DriverInstanceState::Running;
            driver.last_error = None;
            driver.updated_at = chrono::Utc::now();
            runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
            let snapshot = merge_status_defaults(
                driver,
                Some((true, Some(1), None, None, None)),
            );
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
            let driver_response = driver.clone();
            drop(drivers);
            publish_driver_status(&state, &driver_response, &snapshot).await;
            HttpResponse::Ok().json(driver_response)
        }
        Err(err) => {
            let mut drivers = state.driver_instances.write().await;
            let Some(driver) = drivers.get_mut(id.as_str()) else {
                return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
            };
            driver.state = DriverInstanceState::Error;
            driver.last_error = Some(err.to_string());
            driver.updated_at = chrono::Utc::now();
            runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
            let snapshot = merge_status_defaults(
                driver,
                Some((false, None, None, None, Some(err.to_string()))),
            );
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
            let driver_response = driver.clone();
            drop(drivers);
            publish_driver_status(&state, &driver_response, &snapshot).await;
            HttpResponse::BadGateway().json(serde_json::json!({"error": err.to_string()}))
        }
    }
}

pub async fn stop_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let driver_snapshot = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };
    let backend = match resolve_backend_for_driver(&state, &driver_snapshot).await {
        Ok(b) => b,
        Err(response) => return response,
    };

    match backend.stop_driver(&driver_snapshot).await {
        Ok(()) => {
            let mut drivers = state.driver_instances.write().await;
            let Some(driver) = drivers.get_mut(id.as_str()) else {
                return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
            };
            driver.state = DriverInstanceState::Stopped;
            driver.last_error = None;
            driver.updated_at = chrono::Utc::now();
            runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
            let snapshot = merge_status_defaults(
                driver,
                Some((false, Some(0), None, None, None)),
            );
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
            let driver_response = driver.clone();
            drop(drivers);
            publish_driver_status(&state, &driver_response, &snapshot).await;
            HttpResponse::Ok().json(driver_response)
        }
        Err(err) => {
            let mut drivers = state.driver_instances.write().await;
            let Some(driver) = drivers.get_mut(id.as_str()) else {
                return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
            };
            driver.state = DriverInstanceState::Error;
            driver.last_error = Some(err.to_string());
            driver.updated_at = chrono::Utc::now();
            runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
            let snapshot = merge_status_defaults(
                driver,
                Some((false, None, None, None, Some(err.to_string()))),
            );
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
            let driver_response = driver.clone();
            drop(drivers);
            publish_driver_status(&state, &driver_response, &snapshot).await;
            HttpResponse::BadGateway().json(serde_json::json!({"error": err.to_string()}))
        }
    }
}

pub async fn read_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<ReadTagRequest>) -> impl Responder {
    let driver = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };
    match execute_driver_read(&state, &driver, &body.tag_id).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(error_response) => error_response,
    }
}

pub async fn write_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<WriteTagRequest>) -> impl Responder {
    let authority = get_authority_for_pea(&state, &body.pea_id).await;
    if let Err(message) = authority_service::validate_write_request(&authority, &body.actor_class) {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": message}));
    }

    let driver = {
        let drivers = state.driver_instances.read().await;
        match drivers.get(id.as_str()) {
            Some(driver) => driver.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Driver not found"}))
            }
        }
    };
    match execute_driver_write(&state, &driver, &body.tag_id, body.value.clone()).await {
        Ok(result) => HttpResponse::Ok().json(serde_json::json!({
            "tag_id": result.tag_id,
            "value": body.value,
            "actor_id": body.actor_id,
            "status": "accepted",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })),
        Err(error_response) => error_response,
    }
}

pub(crate) async fn get_authority_for_pea(state: &web::Data<AppState>, pea_id: &str) -> AuthorityState {
    let authority_states = state.authority_states.read().await;
    authority_states.get(pea_id).cloned().unwrap_or_else(|| authority_service::default_authority_state(pea_id))
}

#[derive(Clone)]
pub(crate) struct DriverTagContext {
    pub group_name: String,
    pub tag: DriverTag,
}

#[derive(Clone)]
pub(crate) struct DriverWriteResponse {
    pub tag_id: String,
}

fn resolve_driver_tag(driver: &DriverInstance, tag_id: &str) -> Option<DriverTagContext> {
    driver.tag_groups.iter().find_map(|group| {
        group.tags.iter().find(|tag| tag.id == tag_id).map(|tag| DriverTagContext {
            group_name: group.name.clone(),
            tag: tag.clone(),
        })
    })
}

pub(crate) async fn execute_driver_read(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    tag_id: &str,
) -> Result<serde_json::Value, HttpResponse> {
    let backend = resolve_backend_for_driver(state, driver).await?;
    let Some(tag_context) = resolve_driver_tag(driver, tag_id) else {
        return Err(HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})));
    };

    if !matches!(tag_context.tag.access, TagAccess::Read | TagAccess::ReadWrite) {
        return Err(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Tag does not support read access"
        })));
    }

    match backend
        .read_tag(driver, &tag_context.group_name, &tag_context.tag.name)
        .await
    {
        Ok(read_result) => {
            let message = read_result
                .error
                .and_then(|code| if code == 0 { None } else { Some(format!("Driver error {}", code)) });
            let snapshot = update_last_read(
                state,
                driver,
                DriverOperationRecord {
                    tag_id: tag_context.tag.id.clone(),
                    tag_name: tag_context.tag.name.clone(),
                    value: read_result.value.clone().unwrap_or(Value::Null),
                    ok: message.is_none(),
                    message: message.clone(),
                    timestamp: chrono::Utc::now(),
                },
            )
            .await;
            publish_driver_status(state, driver, &snapshot).await;
            Ok(serde_json::json!({
                "tag_id": tag_context.tag.id,
                "tag_name": tag_context.tag.name,
                "value": read_result.value,
                "error": read_result.error,
                "quality": if message.is_none() { "good" } else { "bad" },
                "timestamp": chrono::Utc::now().to_rfc3339(),
            }))
        }
        Err(err) => {
            let snapshot = update_status_error(state, driver, err.to_string()).await;
            publish_driver_status(state, driver, &snapshot).await;
            Err(HttpResponse::BadGateway().json(serde_json::json!({
                "error": err.to_string()
            })))
        }
    }
}

pub(crate) async fn execute_driver_write(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    tag_id: &str,
    value: Value,
) -> Result<DriverWriteResponse, HttpResponse> {
    let backend = resolve_backend_for_driver(state, driver).await?;
    let Some(tag_context) = resolve_driver_tag(driver, tag_id) else {
        return Err(HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})));
    };

    if !matches!(tag_context.tag.access, TagAccess::Write | TagAccess::ReadWrite) {
        return Err(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Tag does not support write access"
        })));
    }

    match backend
        .write_tag(driver, &tag_context.group_name, &tag_context.tag.name, value.clone())
        .await
    {
        Ok(()) => {
            let snapshot = update_last_write(
                state,
                driver,
                DriverOperationRecord {
                    tag_id: tag_context.tag.id.clone(),
                    tag_name: tag_context.tag.name.clone(),
                    value,
                    ok: true,
                    message: None,
                    timestamp: chrono::Utc::now(),
                },
            )
            .await;
            publish_driver_status(state, driver, &snapshot).await;
            Ok(DriverWriteResponse {
                tag_id: tag_context.tag.id,
            })
        }
        Err(err) => {
            let snapshot = update_status_error(state, driver, err.to_string()).await;
            publish_driver_status(state, driver, &snapshot).await;
            Err(HttpResponse::BadGateway().json(serde_json::json!({
                "error": err.to_string()
            })))
        }
    }
}

fn default_tag_groups(driver_key: &str) -> Vec<TagGroup> {
    match driver_key {
        "siemens-s7" => vec![TagGroup {
            id: "main".to_string(),
            name: "Main Signals".to_string(),
            description: Some("Starter read/write tags for initial S7 validation".to_string()),
            tags: vec![
                DriverTag {
                    id: "tag-flow-enable".to_string(),
                    name: "Flow Enable".to_string(),
                    address: "DB1,X0.0".to_string(),
                    data_type: DriverDataType::Bool,
                    access: TagAccess::ReadWrite,
                    scan_ms: Some(250),
                    attributes: serde_json::json!({}),
                },
                DriverTag {
                    id: "tag-line-pressure".to_string(),
                    name: "Line Pressure".to_string(),
                    address: "DB1,REAL4".to_string(),
                    data_type: DriverDataType::Float32,
                    access: TagAccess::Read,
                    scan_ms: Some(250),
                    attributes: serde_json::json!({}),
                },
            ],
        }],
        "siemens-s7-native" => vec![TagGroup {
            id: "main".to_string(),
            name: "Main Signals".to_string(),
            description: Some("Default I/O tags for native S7 connection".to_string()),
            tags: vec![
                DriverTag {
                    id: "tag-input-0-0".to_string(),
                    name: "I0_0".to_string(),
                    address: "I0.0".to_string(),
                    data_type: DriverDataType::Bool,
                    access: TagAccess::Read,
                    scan_ms: Some(250),
                    attributes: serde_json::json!({}),
                },
                DriverTag {
                    id: "tag-output-0-0".to_string(),
                    name: "Q0_0".to_string(),
                    address: "Q0.0".to_string(),
                    data_type: DriverDataType::Bool,
                    access: TagAccess::ReadWrite,
                    scan_ms: Some(250),
                    attributes: serde_json::json!({}),
                },
            ],
        }],
        _ => Vec::new(),
    }
}

pub(crate) fn node_name_for_driver(driver: &DriverInstance) -> String {
    match driver.driver_key.as_str() {
        "siemens-s7-native" => format!("native-s7-{}", &driver.id[..8.min(driver.id.len())]),
        _ => crate::neuron_client::neuron_node_name(driver),
    }
}

fn default_status_snapshot(driver: &DriverInstance) -> DriverStatusSnapshot {
    DriverStatusSnapshot {
        driver_id: driver.id.clone(),
        node_name: node_name_for_driver(driver),
        state: driver.state.clone(),
        remote_running: None,
        remote_link: None,
        remote_rtt: None,
        last_error: driver.last_error.clone(),
        last_read: None,
        last_write: None,
        updated_at: chrono::Utc::now(),
    }
}

fn merge_status_defaults(
    driver: &DriverInstance,
    overrides: Option<(bool, Option<i64>, Option<i64>, Option<DriverOperationRecord>, Option<String>)>,
) -> DriverStatusSnapshot {
    let mut snapshot = default_status_snapshot(driver);
    if let Some((running, link, rtt, last_read, last_error)) = overrides {
        snapshot.remote_running = Some(running);
        snapshot.remote_link = link;
        snapshot.remote_rtt = rtt;
        snapshot.last_read = last_read;
        snapshot.last_error = last_error.or_else(|| driver.last_error.clone());
    }
    snapshot
}

fn remote_data_type(data_type: Option<i32>) -> DriverDataType {
    match data_type.unwrap_or_default() {
        11 | 12 => DriverDataType::Bool,
        3 => DriverDataType::Int16,
        4 => DriverDataType::Uint16,
        5 => DriverDataType::Int32,
        6 => DriverDataType::Uint32,
        9 => DriverDataType::Float32,
        10 => DriverDataType::Float64,
        13 => DriverDataType::String,
        _ => DriverDataType::String,
    }
}

fn remote_tag_access(access: Option<i32>) -> TagAccess {
    match access.unwrap_or(0x01) {
        0x02 => TagAccess::Write,
        0x03 => TagAccess::ReadWrite,
        _ => TagAccess::Read,
    }
}

async fn current_driver_status(state: &web::Data<AppState>, driver: &DriverInstance) -> DriverStatusSnapshot {
    let statuses = state.driver_statuses.read().await;
    statuses
        .get(&driver.id)
        .cloned()
        .unwrap_or_else(|| default_status_snapshot(driver))
}

async fn update_last_read(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    record: DriverOperationRecord,
) -> DriverStatusSnapshot {
    let mut statuses = state.driver_statuses.write().await;
    let status = statuses
        .entry(driver.id.clone())
        .or_insert_with(|| default_status_snapshot(driver));
    status.last_read = Some(record);
    status.updated_at = chrono::Utc::now();
    status.clone()
}

async fn update_last_write(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    record: DriverOperationRecord,
) -> DriverStatusSnapshot {
    let mut statuses = state.driver_statuses.write().await;
    let status = statuses
        .entry(driver.id.clone())
        .or_insert_with(|| default_status_snapshot(driver));
    status.last_write = Some(record);
    status.updated_at = chrono::Utc::now();
    status.clone()
}

async fn update_status_error(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    message: String,
) -> DriverStatusSnapshot {
    let mut statuses = state.driver_statuses.write().await;
    let status = statuses
        .entry(driver.id.clone())
        .or_insert_with(|| default_status_snapshot(driver));
    status.last_error = Some(message);
    status.updated_at = chrono::Utc::now();
    status.clone()
}

fn driver_status_topic(driver: &DriverInstance) -> String {
    format!(
        "entmoot/runtime/nodes/{}/drivers/{}/status",
        driver.runtime_node_id, driver.id
    )
}

async fn publish_driver_status(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    snapshot: &DriverStatusSnapshot,
) {
    let topic = driver_status_topic(driver);
    let payload = serde_json::to_string(snapshot).unwrap_or_else(|_| "{}".to_string());
    let _ = state.zenoh_session.put(&topic, payload).await;
}

pub async fn import_driver_tags(
    state: web::Data<AppState>,
    id: web::Path<String>,
    mut payload: actix_multipart::Multipart,
) -> impl Responder {
    use futures_util::{StreamExt, TryStreamExt};

    // Read the uploaded file
    let mut file_bytes: Vec<u8> = Vec::new();
    let mut filename = String::from("unknown.csv");

    while let Ok(Some(mut field)) = payload.try_next().await {
        if let Some(disposition) = field.content_disposition() {
            if let Some(name) = disposition.get_filename() {
                filename = name.to_string();
            }
        }
        while let Some(Ok(chunk)) = field.next().await {
            file_bytes.extend_from_slice(&chunk);
        }
        break; // only process first file
    }

    if file_bytes.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "No file uploaded"}));
    }

    // Parse the TIA file
    let tia_tags = match crate::tia_importer::parse_tia_file(&filename, &file_bytes) {
        Ok(tags) => tags,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Failed to parse TIA file: {}", e)
            }));
        }
    };

    let imported_groups = crate::tia_importer::to_tag_groups(tia_tags);
    let imported_count: usize = imported_groups.iter().map(|g| g.tags.len()).sum();

    // Merge with existing driver
    let mut drivers = state.driver_instances.write().await;
    let driver = match drivers.get_mut(id.as_str()) {
        Some(d) => d,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
        }
    };

    // Collect existing tag IDs to avoid duplicates
    let existing_ids: std::collections::HashSet<String> = driver
        .tag_groups
        .iter()
        .flat_map(|g| g.tags.iter().map(|t| t.id.clone()))
        .collect();

    for imported_group in imported_groups {
        // Find existing group with same name, or create new
        let existing_group = driver.tag_groups.iter_mut().find(|g| g.name == imported_group.name);

        let new_tags: Vec<DriverTag> = imported_group
            .tags
            .into_iter()
            .filter(|t| !existing_ids.contains(&t.id))
            .collect();

        if let Some(group) = existing_group {
            group.tags.extend(new_tags);
        } else if !new_tags.is_empty() {
            driver.tag_groups.push(TagGroup {
                id: imported_group.id,
                name: imported_group.name,
                description: imported_group.description,
                tags: new_tags,
            });
        }
    }

    driver.updated_at = chrono::Utc::now();

    let updated_driver = driver.clone();
    runtime_store::persist_json(&state.driver_dir, &updated_driver.id, &updated_driver);

    HttpResponse::Ok().json(serde_json::json!({
        "driver": updated_driver,
        "imported_tags": imported_count,
        "filename": filename,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_driver() -> DriverInstance {
        DriverInstance {
            id: "driver-12345678".to_string(),
            runtime_node_id: "runtime-1".to_string(),
            pea_id: "pea-1".to_string(),
            driver_key: "siemens-s7".to_string(),
            display_name: "S7".to_string(),
            state: DriverInstanceState::Created,
            config: serde_json::json!({}),
            tag_groups: Vec::new(),
            last_error: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn driver_status_topic_uses_runtime_and_driver_ids() {
        let driver = sample_driver();
        assert_eq!(
            driver_status_topic(&driver),
            "entmoot/runtime/nodes/runtime-1/drivers/driver-12345678/status"
        );
    }

    #[test]
    fn default_status_snapshot_uses_node_name() {
        let driver = sample_driver();
        let snapshot = default_status_snapshot(&driver);
        assert_eq!(snapshot.driver_id, driver.id);
        assert_eq!(snapshot.node_name, node_name_for_driver(&driver));
        assert!(snapshot.remote_running.is_none());
    }

    #[test]
    fn merge_status_defaults_applies_overrides() {
        let mut driver = sample_driver();
        driver.last_error = Some("prior".to_string());
        let snapshot = merge_status_defaults(
            &driver,
            Some((true, Some(1), Some(25), None, Some("current".to_string()))),
        );
        assert_eq!(snapshot.remote_running, Some(true));
        assert_eq!(snapshot.remote_link, Some(1));
        assert_eq!(snapshot.remote_rtt, Some(25));
        assert_eq!(snapshot.last_error.as_deref(), Some("current"));
    }
}
