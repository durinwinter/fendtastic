use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::runtime::{NeuronConnection, NeuronAccessMode, RuntimeArchitecture, RuntimeNode, RuntimeNodeHealthCheck, RuntimeNodeStatus};
use uuid::Uuid;
use crate::neuron_client::NeuronHttpClient;

#[derive(serde::Deserialize)]
pub struct CreateRuntimeNodeRequest {
    pub name: String,
    pub architecture: RuntimeArchitecture,
    pub host: String,
    pub neuron: NeuronConnection,
    pub assigned_pea_id: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct UpdateRuntimeNodeRequest {
    pub name: Option<String>,
    pub architecture: Option<RuntimeArchitecture>,
    pub host: Option<String>,
    pub neuron: Option<NeuronConnection>,
    pub assigned_pea_id: Option<String>,
    pub status: Option<RuntimeNodeStatus>,
}

pub async fn list_runtime_nodes(state: web::Data<AppState>) -> impl Responder {
    let nodes = state.runtime_nodes.read().await;
    let list: Vec<RuntimeNode> = nodes.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_runtime_node(state: web::Data<AppState>, body: web::Json<CreateRuntimeNodeRequest>) -> impl Responder {
    if let Some(pea_id) = &body.assigned_pea_id {
        let pea_configs = state.pea_configs.read().await;
        if !pea_configs.contains_key(pea_id) {
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Assigned PEA does not exist"}));
        }
    }

    let now = chrono::Utc::now();
    let node = RuntimeNode {
        id: Uuid::new_v4().to_string(),
        name: body.name.clone(),
        architecture: body.architecture.clone(),
        host: body.host.clone(),
        neuron: body.neuron.clone(),
        assigned_pea_id: body.assigned_pea_id.clone(),
        status: RuntimeNodeStatus::Unknown,
        created_at: now,
        updated_at: now,
    };

    runtime_store::persist_json(&state.runtime_node_dir, &node.id, &node);
    state.runtime_nodes.write().await.insert(node.id.clone(), node.clone());
    HttpResponse::Created().json(node)
}

pub async fn get_runtime_node(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let nodes = state.runtime_nodes.read().await;
    match nodes.get(id.as_str()) {
        Some(node) => HttpResponse::Ok().json(node),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Runtime node not found"})),
    }
}

pub async fn update_runtime_node(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<UpdateRuntimeNodeRequest>) -> impl Responder {
    let mut nodes = state.runtime_nodes.write().await;
    let Some(existing) = nodes.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Runtime node not found"}));
    };

    if let Some(pea_id) = &body.assigned_pea_id {
        let pea_configs = state.pea_configs.read().await;
        if !pea_configs.contains_key(pea_id) {
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Assigned PEA does not exist"}));
        }
    }

    if let Some(name) = &body.name { existing.name = name.clone(); }
    if let Some(architecture) = &body.architecture { existing.architecture = architecture.clone(); }
    if let Some(host) = &body.host { existing.host = host.clone(); }
    if let Some(neuron) = &body.neuron { existing.neuron = neuron.clone(); }
    if body.assigned_pea_id.is_some() { existing.assigned_pea_id = body.assigned_pea_id.clone(); }
    if let Some(status) = &body.status { existing.status = status.clone(); }
    existing.updated_at = chrono::Utc::now();

    runtime_store::persist_json(&state.runtime_node_dir, &existing.id, existing);
    HttpResponse::Ok().json(existing)
}

pub async fn delete_runtime_node(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut nodes = state.runtime_nodes.write().await;
    if nodes.remove(id.as_str()).is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Runtime node not found"}));
    }
    runtime_store::delete_json(&state.runtime_node_dir, id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn test_runtime_node(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let nodes = state.runtime_nodes.read().await;
    let Some(node) = nodes.get(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Runtime node not found"}));
    };

    let client = NeuronHttpClient::new();
    let mut checks = vec![RuntimeNodeHealthCheck {
        name: "assigned_pea".to_string(),
        ok: node.assigned_pea_id.is_some(),
        message: if node.assigned_pea_id.is_some() {
            "Runtime node has an assigned PEA".to_string()
        } else {
            "Runtime node has no assigned PEA yet".to_string()
        },
    }];

    if !matches!(node.neuron.mode, NeuronAccessMode::Api | NeuronAccessMode::Hybrid) {
        checks.push(RuntimeNodeHealthCheck {
            name: "neuron_mode".to_string(),
            ok: true,
            message: "Runtime node is configured for file-export-only mode".to_string(),
        });
    } else {
        match client.test_connection(&node.neuron).await {
            Ok(mut remote_checks) => checks.append(&mut remote_checks),
            Err(err) => checks.push(RuntimeNodeHealthCheck {
                name: "neuron_api".to_string(),
                ok: false,
                message: err.to_string(),
            }),
        }
    }

    let ok = checks.iter().all(|check| check.ok);
    HttpResponse::Ok().json(serde_json::json!({"ok": ok, "runtime_node_id": node.id, "checks": checks}))
}
