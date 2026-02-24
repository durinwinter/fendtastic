use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use serde_json::json;

use crate::state::AppState;

pub async fn get_metrics(state: web::Data<AppState>) -> impl Responder {
    let store = state.timeseries.read().await;
    let keys_count = store.data.len();
    let points_count: usize = store.data.values().map(|buf| buf.len()).sum();
    let alarms = state.alarms.read().await;
    let active_alarms = alarms
        .values()
        .filter(|a| a.status == "open" || a.status == "acknowledged")
        .count();
    HttpResponse::Ok().json(json!({
        "metrics": [
            {"name": "timeseries_keys", "value": keys_count},
            {"name": "timeseries_points", "value": points_count},
            {"name": "active_alarms", "value": active_alarms}
        ],
        "timestamp": Utc::now().to_rfc3339()
    }))
}

pub async fn get_machines(state: web::Data<AppState>) -> impl Responder {
    let store = state.timeseries.read().await;
    let mut machines: Vec<serde_json::Value> = Vec::new();
    for key in store.data.keys() {
        if key.contains("/swimlane/state") {
            let parts: Vec<&str> = key.split('/').collect();
            if parts.len() >= 6 {
                let pea_id = parts[5];
                if !machines.iter().any(|m| m["id"] == pea_id) {
                    machines.push(json!({
                        "id": pea_id,
                        "name": pea_id,
                        "type": "pea",
                        "status": "operational",
                        "location": {"x": 0, "y": 0, "z": 0}
                    }));
                }
            }
        }
    }
    if machines.is_empty() {
        machines.push(json!({
            "id": "machine-001",
            "name": "APOLLO GROOMER 1001",
            "type": "groomer",
            "status": "operational",
            "location": {"x": 100, "y": 200, "z": 0}
        }));
    }
    HttpResponse::Ok().json(json!({
        "machines": machines
    }))
}

pub async fn get_machine_by_id(
    _state: web::Data<AppState>,
    machine_id: web::Path<String>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "id": machine_id.as_str(),
        "name": "APOLLO GROOMER 1001",
        "type": "groomer",
        "status": "operational",
        "sensors": []
    }))
}

pub async fn get_alarms(state: web::Data<AppState>) -> impl Responder {
    let alarms = state.alarms.read().await;
    let list: Vec<_> = alarms.values().cloned().collect();
    let active = list
        .iter()
        .filter(|a| a.status == "open" || a.status == "acknowledged")
        .count();
    HttpResponse::Ok().json(json!({
        "alarms": list,
        "total": alarms.len(),
        "active": active
    }))
}

pub async fn get_timeseries(
    _state: web::Data<AppState>,
    machine_id: web::Path<String>,
) -> impl Responder {
    let now = Utc::now().to_rfc3339();
    HttpResponse::Ok().json(json!({
        "machine_id": machine_id.as_str(),
        "data": [],
        "start_time": now,
        "end_time": now
    }))
}
