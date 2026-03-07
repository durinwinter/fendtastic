use crate::binding_validation;
use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::binding::{BindingValidationSummary, PeaBinding};
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct CreateBindingRequest {
    pub pea_id: String,
    pub runtime_node_id: String,
    pub driver_instance_id: String,
    pub mappings: Vec<shared::domain::binding::TagBinding>,
}

#[derive(serde::Deserialize)]
pub struct UpdateBindingRequest {
    pub mappings: Vec<shared::domain::binding::TagBinding>,
}

pub async fn list_bindings(state: web::Data<AppState>) -> impl Responder {
    let bindings = state.pea_bindings.read().await;
    let list: Vec<PeaBinding> = bindings.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_binding(state: web::Data<AppState>, body: web::Json<CreateBindingRequest>) -> impl Responder {
    let mut binding = PeaBinding {
        id: Uuid::new_v4().to_string(),
        pea_id: body.pea_id.clone(),
        runtime_node_id: body.runtime_node_id.clone(),
        driver_instance_id: body.driver_instance_id.clone(),
        mappings: body.mappings.clone(),
        validation: BindingValidationSummary::default(),
    };

    binding.validation = binding_validation::validate_binding_request(&state, &binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, &binding);
    state.pea_bindings.write().await.insert(binding.id.clone(), binding.clone());
    HttpResponse::Created().json(binding)
}

pub async fn get_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let bindings = state.pea_bindings.read().await;
    match bindings.get(id.as_str()) {
        Some(binding) => HttpResponse::Ok().json(binding),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"})),
    }
}

pub async fn update_binding(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<UpdateBindingRequest>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    let Some(binding) = bindings.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    };

    binding.mappings = body.mappings.clone();
    binding.validation = binding_validation::validate_binding_request(&state, binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, binding);
    HttpResponse::Ok().json(binding)
}

pub async fn delete_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    if bindings.remove(id.as_str()).is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    }
    runtime_store::delete_json(&state.binding_dir, id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn validate_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    let Some(binding) = bindings.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    };
    binding.validation = binding_validation::validate_binding_request(&state, binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, binding);
    HttpResponse::Ok().json(&binding.validation)
}
