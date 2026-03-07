use crate::authority_service;
use crate::neuron_client::NeuronHttpClient;
use crate::runtime_store;
use crate::state::AppState;
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
    let client = NeuronHttpClient::new();
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
    let runtime_node = {
        let runtime_nodes = state.runtime_nodes.read().await;
        match runtime_nodes.get(&driver.runtime_node_id) {
            Some(runtime_node) => runtime_node.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Runtime node not found"}))
            }
        }
    };

    let mut snapshot = current_driver_status(&state, &driver).await;
    if let Ok(remote_state) = client.get_node_state(&runtime_node.neuron, &driver).await {
        if let Some(remote_state) = remote_state {
            snapshot.remote_running = Some(remote_state.running == 1);
            snapshot.remote_link = Some(remote_state.link);
            snapshot.remote_rtt = remote_state.rtt;
            snapshot.updated_at = chrono::Utc::now();
            state
                .driver_statuses
                .write()
                .await
                .insert(driver.id.clone(), snapshot.clone());
        }
    }

    HttpResponse::Ok().json(snapshot)
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
        tag_groups: default_tag_groups(&body.driver_key),
        last_error: None,
        created_at: now,
        updated_at: now,
    };

    runtime_store::persist_json(&state.driver_dir, &driver.id, &driver);
    state.driver_instances.write().await.insert(driver.id.clone(), driver.clone());
    state
        .driver_statuses
        .write()
        .await
        .insert(driver.id.clone(), default_status_snapshot(&driver));
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
        let runtime_node = {
            let runtime_nodes = state.runtime_nodes.read().await;
            match runtime_nodes.get(&updated_driver.runtime_node_id) {
                Some(runtime_node) => runtime_node.clone(),
                None => {
                    return HttpResponse::BadRequest()
                        .json(serde_json::json!({"error": "Runtime node not found"}))
                }
            }
        };
        let client = NeuronHttpClient::new();
        if let Err(err) = client.sync_driver(&runtime_node.neuron, &updated_driver).await {
            updated_driver.last_error = Some(err.to_string());
            updated_driver.state = DriverInstanceState::Error;
        }
    }

    runtime_store::persist_json(&state.driver_dir, &updated_driver.id, &updated_driver);
    state
        .driver_instances
        .write()
        .await
        .insert(updated_driver.id.clone(), updated_driver.clone());
    state
        .driver_statuses
        .write()
        .await
        .insert(updated_driver.id.clone(), merge_status_defaults(&updated_driver, None));
    HttpResponse::Ok().json(updated_driver)
}

pub async fn delete_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut drivers = state.driver_instances.write().await;
    if drivers.remove(id.as_str()).is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    }
    runtime_store::delete_json(&state.driver_dir, id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn start_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let client = NeuronHttpClient::new();
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
    let runtime_node = {
        let runtime_nodes = state.runtime_nodes.read().await;
        match runtime_nodes.get(&driver_snapshot.runtime_node_id) {
            Some(runtime_node) => runtime_node.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Runtime node not found"}))
            }
        }
    };

    match client.start_driver(&runtime_node.neuron, &driver_snapshot).await {
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
                .insert(driver.id.clone(), snapshot);
            HttpResponse::Ok().json(driver)
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
                .insert(driver.id.clone(), snapshot);
            HttpResponse::BadGateway().json(serde_json::json!({"error": err.to_string()}))
        }
    }
}

pub async fn stop_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let client = NeuronHttpClient::new();
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
    let runtime_node = {
        let runtime_nodes = state.runtime_nodes.read().await;
        match runtime_nodes.get(&driver_snapshot.runtime_node_id) {
            Some(runtime_node) => runtime_node.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Runtime node not found"}))
            }
        }
    };

    match client.stop_driver(&runtime_node.neuron, &driver_snapshot).await {
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
                .insert(driver.id.clone(), snapshot);
            HttpResponse::Ok().json(driver)
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
                .insert(driver.id.clone(), snapshot);
            HttpResponse::BadGateway().json(serde_json::json!({"error": err.to_string()}))
        }
    }
}

pub async fn read_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<ReadTagRequest>) -> impl Responder {
    let client = NeuronHttpClient::new();
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
    let runtime_node = {
        let runtime_nodes = state.runtime_nodes.read().await;
        match runtime_nodes.get(&driver.runtime_node_id) {
            Some(runtime_node) => runtime_node.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Runtime node not found"}))
            }
        }
    };

    let tag_with_group = driver
        .tag_groups
        .iter()
        .find_map(|group| {
            group
                .tags
                .iter()
                .find(|tag| tag.id == body.tag_id)
                .map(|tag| (group.name.clone(), tag.clone()))
        });

    match tag_with_group {
        Some((group_name, tag)) => {
            if !matches!(tag.access, TagAccess::Read | TagAccess::ReadWrite) {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Tag does not support read access"
                }));
            }

            match client
                .read_tag(&runtime_node.neuron, &driver, &group_name, &tag.name)
                .await
            {
                Ok(read_result) => {
                    let message = read_result
                        .error
                        .and_then(|code| if code == 0 { None } else { Some(format!("Neuron error {}", code)) });
                    update_last_read(
                        &state,
                        &driver,
                        DriverOperationRecord {
                            tag_id: tag.id.clone(),
                            tag_name: tag.name.clone(),
                            value: read_result.value.clone().unwrap_or(Value::Null),
                            ok: message.is_none(),
                            message: message.clone(),
                            timestamp: chrono::Utc::now(),
                        },
                    )
                    .await;
                    HttpResponse::Ok().json(serde_json::json!({
                        "tag_id": tag.id,
                        "tag_name": tag.name,
                        "value": read_result.value,
                        "error": read_result.error,
                        "quality": if message.is_none() { "good" } else { "bad" },
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }))
                }
                Err(err) => HttpResponse::BadGateway().json(serde_json::json!({
                    "error": err.to_string()
                })),
            }
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})),
    }
}

pub async fn write_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<WriteTagRequest>) -> impl Responder {
    let client = NeuronHttpClient::new();
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
    let runtime_node = {
        let runtime_nodes = state.runtime_nodes.read().await;
        match runtime_nodes.get(&driver.runtime_node_id) {
            Some(runtime_node) => runtime_node.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Runtime node not found"}))
            }
        }
    };

    let tag_with_group = driver
        .tag_groups
        .iter()
        .find_map(|group| {
            group
                .tags
                .iter()
                .find(|tag| tag.id == body.tag_id)
                .map(|tag| (group.name.clone(), tag.clone()))
        });

    match tag_with_group {
        Some((group_name, tag)) => {
            if !matches!(tag.access, TagAccess::Write | TagAccess::ReadWrite) {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Tag does not support write access"
                }));
            }

            match client
                .write_tag(&runtime_node.neuron, &driver, &group_name, &tag.name, body.value.clone())
                .await
            {
                Ok(()) => {
                    update_last_write(
                        &state,
                        &driver,
                        DriverOperationRecord {
                            tag_id: tag.id.clone(),
                            tag_name: tag.name.clone(),
                            value: body.value.clone(),
                            ok: true,
                            message: None,
                            timestamp: chrono::Utc::now(),
                        },
                    )
                    .await;
                    HttpResponse::Ok().json(serde_json::json!({
                        "tag_id": tag.id,
                        "value": body.value,
                        "actor_id": body.actor_id,
                        "status": "accepted",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }))
                }
                Err(err) => HttpResponse::BadGateway().json(serde_json::json!({
                    "error": err.to_string()
                })),
            }
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})),
    }
}

async fn get_authority_for_pea(state: &web::Data<AppState>, pea_id: &str) -> AuthorityState {
    let authority_states = state.authority_states.read().await;
    authority_states.get(pea_id).cloned().unwrap_or_else(|| authority_service::default_authority_state(pea_id))
}

fn default_tag_groups(driver_key: &str) -> Vec<TagGroup> {
    if driver_key != "siemens-s7" {
        return Vec::new();
    }

    vec![TagGroup {
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
    }]
}

fn default_status_snapshot(driver: &DriverInstance) -> DriverStatusSnapshot {
    DriverStatusSnapshot {
        driver_id: driver.id.clone(),
        node_name: crate::neuron_client::neuron_node_name(driver),
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
) {
    let mut statuses = state.driver_statuses.write().await;
    let status = statuses
        .entry(driver.id.clone())
        .or_insert_with(|| default_status_snapshot(driver));
    status.last_read = Some(record);
    status.updated_at = chrono::Utc::now();
}

async fn update_last_write(
    state: &web::Data<AppState>,
    driver: &DriverInstance,
    record: DriverOperationRecord,
) {
    let mut statuses = state.driver_statuses.write().await;
    let status = statuses
        .entry(driver.id.clone())
        .or_insert_with(|| default_status_snapshot(driver));
    status.last_write = Some(record);
    status.updated_at = chrono::Utc::now();
}
