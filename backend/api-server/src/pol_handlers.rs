use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use tracing::error;

use crate::state::{AppState, PolEdge, PolTopology};

const ALARMS_FILE: &str = "alarms.json";
const TOPOLOGY_FILE: &str = "topology.json";

#[derive(serde::Deserialize)]
pub struct AlarmActionPayload {
    pub action: String,
}

#[derive(serde::Deserialize)]
pub struct TopologyPayload {
    pub edges: Vec<PolEdge>,
}

pub async fn get_topology(state: web::Data<AppState>) -> impl Responder {
    let topology = state.topology.read().await;
    HttpResponse::Ok().json(&*topology)
}

pub async fn put_topology(
    state: web::Data<AppState>,
    body: web::Json<TopologyPayload>,
) -> impl Responder {
    let payload = body.into_inner();
    let topology = PolTopology {
        edges: payload.edges,
        updated_at: Utc::now().to_rfc3339(),
    };

    {
        let mut stored = state.topology.write().await;
        *stored = topology.clone();
    }
    persist_topology(&state.pol_db_dir, &topology);

    let bus_msg = serde_json::json!({
        "edges": topology.edges,
        "updated_at": topology.updated_at,
    });
    let _ = state
        .zenoh_session
        .put("fendtastic/pol/topology", bus_msg.to_string())
        .await;

    HttpResponse::Ok().json(topology)
}

pub async fn ack_alarm(state: web::Data<AppState>, alarm_id: web::Path<String>) -> impl Responder {
    handle_alarm_action(state, alarm_id.into_inner(), "acknowledged").await
}

pub async fn shelve_alarm(
    state: web::Data<AppState>,
    alarm_id: web::Path<String>,
) -> impl Responder {
    handle_alarm_action(state, alarm_id.into_inner(), "shelved").await
}

pub async fn action_alarm(
    state: web::Data<AppState>,
    alarm_id: web::Path<String>,
    body: web::Json<AlarmActionPayload>,
) -> impl Responder {
    handle_alarm_action(state, alarm_id.into_inner(), &body.action).await
}

pub async fn delete_alarm(
    state: web::Data<AppState>,
    alarm_id: web::Path<String>,
) -> impl Responder {
    let id = alarm_id.into_inner();
    {
        let mut alarms = state.alarms.write().await;
        alarms.remove(&id);
        persist_alarms(&state.pol_db_dir, &alarms);
    }
    let _ = state
        .zenoh_session
        .put(
            "fendtastic/pol/alarm/action",
            serde_json::json!({
                "alarm_id": id,
                "action": "delete",
                "timestamp": Utc::now().to_rfc3339(),
            })
            .to_string(),
        )
        .await;
    HttpResponse::NoContent().finish()
}

async fn handle_alarm_action(
    state: web::Data<AppState>,
    alarm_id: String,
    status: &str,
) -> HttpResponse {
    let updated = {
        let mut alarms = state.alarms.write().await;
        if let Some(alarm) = alarms.get_mut(&alarm_id) {
            alarm.status = status.to_string();
            Some(alarm.clone())
        } else {
            None
        }
    };

    match updated {
        Some(alarm) => {
            {
                let alarms = state.alarms.read().await;
                persist_alarms(&state.pol_db_dir, &alarms);
            }
            let _ = state
                .zenoh_session
                .put(
                    "fendtastic/pol/alarm/action",
                    serde_json::json!({
                        "alarm_id": alarm_id,
                        "action": status,
                        "timestamp": Utc::now().to_rfc3339(),
                    })
                    .to_string(),
                )
                .await;
            HttpResponse::Ok().json(alarm)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Alarm not found"})),
    }
}

pub fn load_alarms(dir: &str) -> std::collections::HashMap<String, crate::state::AlarmRecord> {
    let path = format!("{}/{}", dir, ALARMS_FILE);
    match std::fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<
            std::collections::HashMap<String, crate::state::AlarmRecord>,
        >(&content)
        {
            Ok(alarms) => alarms,
            Err(e) => {
                error!("Failed to parse alarms file {}: {}", path, e);
                std::collections::HashMap::new()
            }
        },
        Err(_) => std::collections::HashMap::new(),
    }
}

pub fn persist_alarms(
    dir: &str,
    alarms: &std::collections::HashMap<String, crate::state::AlarmRecord>,
) {
    if let Err(e) = std::fs::create_dir_all(dir) {
        error!("Failed to create POL data dir {}: {}", dir, e);
        return;
    }
    let path = format!("{}/{}", dir, ALARMS_FILE);
    match serde_json::to_string_pretty(alarms) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&path, json) {
                error!("Failed to write alarms to {}: {}", path, e);
            }
        }
        Err(e) => error!("Failed to serialize alarms: {}", e),
    }
}

pub fn load_topology(dir: &str) -> PolTopology {
    let path = format!("{}/{}", dir, TOPOLOGY_FILE);
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str::<PolTopology>(&content).unwrap_or_default(),
        Err(_) => PolTopology::default(),
    }
}

pub fn persist_topology(dir: &str, topology: &PolTopology) {
    if let Err(e) = std::fs::create_dir_all(dir) {
        error!("Failed to create POL data dir {}: {}", dir, e);
        return;
    }
    let path = format!("{}/{}", dir, TOPOLOGY_FILE);
    match serde_json::to_string_pretty(topology) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&path, json) {
                error!("Failed to write topology to {}: {}", path, e);
            }
        }
        Err(e) => error!("Failed to serialize topology: {}", e),
    }
}
