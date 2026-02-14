use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use crate::state::AppState;

pub async fn get_metrics(state: web::Data<AppState>) -> impl Responder {
    // Query Zenoh for latest metrics
    let key_expr = "fendtastic/metrics/**";

    // In production, this would query Zenoh storage or subscriber
    HttpResponse::Ok().json(json!({
        "metrics": [],
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub async fn get_machines(state: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "machines": [
            {
                "id": "machine-001",
                "name": "APOLLO GROOMER 1001",
                "type": "groomer",
                "status": "operational",
                "location": {"x": 100, "y": 200, "z": 0}
            }
        ]
    }))
}

pub async fn get_machine_by_id(
    state: web::Data<AppState>,
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
    HttpResponse::Ok().json(json!({
        "alarms": [],
        "total": 0,
        "active": 0
    }))
}

pub async fn get_timeseries(
    state: web::Data<AppState>,
    machine_id: web::Path<String>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "machine_id": machine_id.as_str(),
        "data": [],
        "start_time": chrono::Utc::now().to_rfc3339(),
        "end_time": chrono::Utc::now().to_rfc3339()
    }))
}
