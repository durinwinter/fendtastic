use crate::authority_service;
use crate::neuron_client::NeuronHttpClient;
use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::authority::{ActorClass, AuthorityState};
use shared::domain::driver::{
    DriverDataType, DriverInstance, DriverInstanceState, DriverTag, TagAccess, TagGroup,
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

pub async fn list_drivers(state: web::Data<AppState>) -> impl Responder {
    let drivers = state.driver_instances.read().await;
    let list: Vec<DriverInstance> = drivers.values().cloned().collect();
    HttpResponse::Ok().json(list)
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
    let mut drivers = state.driver_instances.write().await;
    let Some(driver) = drivers.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    };

    if let Some(name) = &body.display_name { driver.display_name = name.clone(); }
    if let Some(config) = &body.config { driver.config = config.clone(); }
    if let Some(tag_groups) = &body.tag_groups { driver.tag_groups = tag_groups.clone(); }
    if let Some(state_value) = &body.state { driver.state = state_value.clone(); }
    if body.last_error.is_some() { driver.last_error = body.last_error.clone(); }
    driver.updated_at = chrono::Utc::now();

    runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
    HttpResponse::Ok().json(driver)
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
                Ok(read_result) => HttpResponse::Ok().json(serde_json::json!({
                    "tag_id": tag.id,
                    "tag_name": tag.name,
                    "value": read_result.value,
                    "error": read_result.error,
                    "quality": if read_result.error.unwrap_or_default() == 0 { "good" } else { "bad" },
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                })),
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
                Ok(()) => HttpResponse::Ok().json(serde_json::json!({
                    "tag_id": tag.id,
                    "value": body.value,
                    "actor_id": body.actor_id,
                    "status": "accepted",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                })),
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
