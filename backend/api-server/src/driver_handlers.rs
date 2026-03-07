use crate::authority_service;
use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::authority::{ActorClass, AuthorityState};
use shared::domain::driver::{DriverInstance, DriverInstanceState, TagGroup};
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
        tag_groups: Vec::new(),
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
    set_driver_state(state, id.as_str(), DriverInstanceState::Running).await
}

pub async fn stop_driver(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    set_driver_state(state, id.as_str(), DriverInstanceState::Stopped).await
}

pub async fn read_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<ReadTagRequest>) -> impl Responder {
    let drivers = state.driver_instances.read().await;
    let Some(driver) = drivers.get(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    };

    let tag = driver
        .tag_groups
        .iter()
        .flat_map(|group| group.tags.iter())
        .find(|tag| tag.id == body.tag_id);

    match tag {
        Some(tag) => HttpResponse::Ok().json(serde_json::json!({
            "tag_id": tag.id,
            "value": sample_value_for_tag(tag.data_type.clone()),
            "quality": "good",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})),
    }
}

pub async fn write_driver_tag(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<WriteTagRequest>) -> impl Responder {
    let authority = get_authority_for_pea(&state, &body.pea_id).await;
    if let Err(message) = authority_service::validate_write_request(&authority, &body.actor_class) {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": message}));
    }

    let drivers = state.driver_instances.read().await;
    let Some(driver) = drivers.get(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    };

    let tag = driver
        .tag_groups
        .iter()
        .flat_map(|group| group.tags.iter())
        .find(|tag| tag.id == body.tag_id);

    match tag {
        Some(tag) => HttpResponse::Ok().json(serde_json::json!({
            "tag_id": tag.id,
            "value": body.value,
            "actor_id": body.actor_id,
            "status": "accepted",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Tag not found"})),
    }
}

async fn set_driver_state(state: web::Data<AppState>, id: &str, target_state: DriverInstanceState) -> HttpResponse {
    let mut drivers = state.driver_instances.write().await;
    let Some(driver) = drivers.get_mut(id) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Driver not found"}));
    };
    driver.state = target_state;
    driver.updated_at = chrono::Utc::now();
    runtime_store::persist_json(&state.driver_dir, &driver.id, driver);
    HttpResponse::Ok().json(driver)
}

async fn get_authority_for_pea(state: &web::Data<AppState>, pea_id: &str) -> AuthorityState {
    let authority_states = state.authority_states.read().await;
    authority_states.get(pea_id).cloned().unwrap_or_else(|| authority_service::default_authority_state(pea_id))
}

fn sample_value_for_tag(data_type: shared::domain::driver::DriverDataType) -> serde_json::Value {
    match data_type {
        shared::domain::driver::DriverDataType::Bool => serde_json::json!(true),
        shared::domain::driver::DriverDataType::Int16
        | shared::domain::driver::DriverDataType::Uint16
        | shared::domain::driver::DriverDataType::Int32
        | shared::domain::driver::DriverDataType::Uint32 => serde_json::json!(42),
        shared::domain::driver::DriverDataType::Float32
        | shared::domain::driver::DriverDataType::Float64 => serde_json::json!(3.14),
        shared::domain::driver::DriverDataType::String => serde_json::json!("sample"),
    }
}
