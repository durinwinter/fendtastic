use crate::authority_service;
use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::authority::AuthorityChangeRequest;

pub async fn get_authority_state(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let authority_states = state.authority_states.read().await;
    match authority_states.get(pea_id.as_str()) {
        Some(authority) => HttpResponse::Ok().json(authority),
        None => HttpResponse::Ok().json(authority_service::default_authority_state(pea_id.as_str())),
    }
}

pub async fn set_authority_state(state: web::Data<AppState>, pea_id: web::Path<String>, body: web::Json<AuthorityChangeRequest>) -> impl Responder {
    {
        let pea_configs = state.pea_configs.read().await;
        if !pea_configs.contains_key(pea_id.as_str()) {
            return HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"}));
        }
    }

    let (authority, audit) = authority_service::apply_authority_change(pea_id.as_str(), body.into_inner());
    runtime_store::persist_json(&state.authority_dir, pea_id.as_str(), &authority);

    state.authority_states.write().await.insert(pea_id.to_string(), authority.clone());
    state.authority_audit.write().await.push(audit);

    let topic = format!("entmoot/habitat/pea/{}/authority", pea_id.as_str());
    let _ = state.zenoh_session.put(&topic, serde_json::to_string(&authority).unwrap_or_else(|_| "{}".to_string())).await;

    HttpResponse::Ok().json(authority)
}

pub async fn get_authority_audit(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let audit = state.authority_audit.read().await;
    let records: Vec<_> = audit.iter().filter(|record| record.pea_id == pea_id.as_str()).cloned().collect();
    HttpResponse::Ok().json(records)
}
