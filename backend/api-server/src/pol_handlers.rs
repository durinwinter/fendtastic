use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use tracing::error;

use crate::state::{AlarmRule, AppState, BlackoutWindow, PolEdge, PolTopology};

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

#[derive(serde::Deserialize)]
pub struct AlarmRulePayload {
    pub name: String,
    pub severity: String,
    pub source_pattern: String,
    pub event_pattern: String,
    pub enabled: bool,
}

#[derive(serde::Deserialize)]
pub struct BlackoutPayload {
    pub name: String,
    pub starts_at: String,
    pub ends_at: String,
    pub scope: Option<String>,
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
    if let Err(e) = upsert_topology_db(&state.db_client, &topology).await {
        error!("Failed to persist topology in Postgres: {}", e);
    }

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
    if let Err(e) = delete_alarm_db(&state.db_client, &id).await {
        error!("Failed to delete alarm {} in Postgres: {}", id, e);
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
            if let Err(e) = upsert_alarm_db(&state.db_client, &alarm).await {
                error!("Failed to persist alarm in Postgres: {}", e);
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

pub async fn list_alarm_rules(state: web::Data<AppState>) -> impl Responder {
    let rules = state.alarm_rules.read().await;
    let list: Vec<AlarmRule> = rules.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_alarm_rule(
    state: web::Data<AppState>,
    body: web::Json<AlarmRulePayload>,
) -> impl Responder {
    let now = Utc::now().to_rfc3339();
    let rule = AlarmRule {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name.clone(),
        severity: body.severity.clone(),
        source_pattern: body.source_pattern.clone(),
        event_pattern: body.event_pattern.clone(),
        enabled: body.enabled,
        created_at: now.clone(),
        updated_at: now,
    };
    {
        let mut rules = state.alarm_rules.write().await;
        rules.insert(rule.id.clone(), rule.clone());
    }
    if let Err(e) = upsert_alarm_rule_db(&state.db_client, &rule).await {
        error!("Failed to persist alarm rule in Postgres: {}", e);
    }
    HttpResponse::Created().json(rule)
}

pub async fn update_alarm_rule(
    state: web::Data<AppState>,
    rule_id: web::Path<String>,
    body: web::Json<AlarmRulePayload>,
) -> impl Responder {
    let id = rule_id.into_inner();
    let updated = {
        let mut rules = state.alarm_rules.write().await;
        if let Some(rule) = rules.get_mut(&id) {
            rule.name = body.name.clone();
            rule.severity = body.severity.clone();
            rule.source_pattern = body.source_pattern.clone();
            rule.event_pattern = body.event_pattern.clone();
            rule.enabled = body.enabled;
            rule.updated_at = Utc::now().to_rfc3339();
            Some(rule.clone())
        } else {
            None
        }
    };
    match updated {
        Some(rule) => {
            if let Err(e) = upsert_alarm_rule_db(&state.db_client, &rule).await {
                error!("Failed to persist alarm rule in Postgres: {}", e);
            }
            HttpResponse::Ok().json(rule)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Rule not found"})),
    }
}

pub async fn delete_alarm_rule(
    state: web::Data<AppState>,
    rule_id: web::Path<String>,
) -> impl Responder {
    let id = rule_id.into_inner();
    {
        let mut rules = state.alarm_rules.write().await;
        rules.remove(&id);
    }
    if let Err(e) = delete_alarm_rule_db(&state.db_client, &id).await {
        error!("Failed to delete alarm rule from Postgres: {}", e);
    }
    HttpResponse::NoContent().finish()
}

pub async fn list_blackouts(state: web::Data<AppState>) -> impl Responder {
    let windows = state.blackout_windows.read().await;
    let list: Vec<BlackoutWindow> = windows.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_blackout(
    state: web::Data<AppState>,
    body: web::Json<BlackoutPayload>,
) -> impl Responder {
    let starts_at = match DateTime::parse_from_rfc3339(&body.starts_at) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "starts_at must be RFC3339"}));
        }
    };
    let ends_at = match DateTime::parse_from_rfc3339(&body.ends_at) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "ends_at must be RFC3339"}));
        }
    };
    if ends_at <= starts_at {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "ends_at must be after starts_at"}));
    }

    let blackout = BlackoutWindow {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name.clone(),
        starts_at: starts_at.to_rfc3339(),
        ends_at: ends_at.to_rfc3339(),
        scope: body.scope.clone().unwrap_or_else(|| "global".to_string()),
        created_at: Utc::now().to_rfc3339(),
    };
    {
        let mut windows = state.blackout_windows.write().await;
        windows.insert(blackout.id.clone(), blackout.clone());
    }
    if let Err(e) = upsert_blackout_db(&state.db_client, &blackout).await {
        error!("Failed to persist blackout in Postgres: {}", e);
    }
    HttpResponse::Created().json(blackout)
}

pub async fn delete_blackout(
    state: web::Data<AppState>,
    blackout_id: web::Path<String>,
) -> impl Responder {
    let id = blackout_id.into_inner();
    {
        let mut windows = state.blackout_windows.write().await;
        windows.remove(&id);
    }
    if let Err(e) = delete_blackout_db(&state.db_client, &id).await {
        error!("Failed to delete blackout from Postgres: {}", e);
    }
    HttpResponse::NoContent().finish()
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

pub async fn upsert_alarm_db(
    client: &tokio_postgres::Client,
    alarm: &crate::state::AlarmRecord,
) -> anyhow::Result<()> {
    let ts = DateTime::parse_from_rfc3339(&alarm.timestamp)?.with_timezone(&Utc);
    client
        .execute(
            "INSERT INTO alarms (id, severity, status, source, event, value, description, timestamp, duplicate_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE SET
               severity=EXCLUDED.severity,
               status=EXCLUDED.status,
               source=EXCLUDED.source,
               event=EXCLUDED.event,
               value=EXCLUDED.value,
               description=EXCLUDED.description,
               timestamp=EXCLUDED.timestamp,
               duplicate_count=EXCLUDED.duplicate_count",
            &[
                &alarm.id,
                &alarm.severity,
                &alarm.status,
                &alarm.source,
                &alarm.event,
                &alarm.value,
                &alarm.description,
                &ts,
                &(alarm.duplicate_count as i32),
            ],
        )
        .await?;
    Ok(())
}

pub async fn delete_alarm_db(
    client: &tokio_postgres::Client,
    alarm_id: &str,
) -> anyhow::Result<()> {
    client
        .execute("DELETE FROM alarms WHERE id=$1", &[&alarm_id])
        .await?;
    Ok(())
}

pub async fn upsert_topology_db(
    client: &tokio_postgres::Client,
    topology: &PolTopology,
) -> anyhow::Result<()> {
    let updated_at = DateTime::parse_from_rfc3339(&topology.updated_at)?.with_timezone(&Utc);
    client.execute("DELETE FROM topology_edges", &[]).await?;
    for edge in &topology.edges {
        client
            .execute(
                "INSERT INTO topology_edges (source_pea, target_pea, updated_at) VALUES ($1,$2,$3)",
                &[&edge.from, &edge.to, &updated_at],
            )
            .await?;
    }
    Ok(())
}

pub async fn upsert_alarm_rule_db(
    client: &tokio_postgres::Client,
    rule: &AlarmRule,
) -> anyhow::Result<()> {
    let created_at = DateTime::parse_from_rfc3339(&rule.created_at)?.with_timezone(&Utc);
    let updated_at = DateTime::parse_from_rfc3339(&rule.updated_at)?.with_timezone(&Utc);
    client
        .execute(
            "INSERT INTO alarm_rules (id, name, severity, source_pattern, event_pattern, enabled, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name,
               severity=EXCLUDED.severity,
               source_pattern=EXCLUDED.source_pattern,
               event_pattern=EXCLUDED.event_pattern,
               enabled=EXCLUDED.enabled,
               updated_at=EXCLUDED.updated_at",
            &[
                &rule.id,
                &rule.name,
                &rule.severity,
                &rule.source_pattern,
                &rule.event_pattern,
                &rule.enabled,
                &created_at,
                &updated_at,
            ],
        )
        .await?;
    Ok(())
}

pub async fn delete_alarm_rule_db(
    client: &tokio_postgres::Client,
    rule_id: &str,
) -> anyhow::Result<()> {
    client
        .execute("DELETE FROM alarm_rules WHERE id=$1", &[&rule_id])
        .await?;
    Ok(())
}

pub async fn upsert_blackout_db(
    client: &tokio_postgres::Client,
    w: &BlackoutWindow,
) -> anyhow::Result<()> {
    let starts_at = DateTime::parse_from_rfc3339(&w.starts_at)?.with_timezone(&Utc);
    let ends_at = DateTime::parse_from_rfc3339(&w.ends_at)?.with_timezone(&Utc);
    let created_at = DateTime::parse_from_rfc3339(&w.created_at)?.with_timezone(&Utc);
    client
        .execute(
            "INSERT INTO blackout_windows (id, name, starts_at, ends_at, scope, created_at)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name,
               starts_at=EXCLUDED.starts_at,
               ends_at=EXCLUDED.ends_at,
               scope=EXCLUDED.scope",
            &[&w.id, &w.name, &starts_at, &ends_at, &w.scope, &created_at],
        )
        .await?;
    Ok(())
}

pub async fn delete_blackout_db(
    client: &tokio_postgres::Client,
    blackout_id: &str,
) -> anyhow::Result<()> {
    client
        .execute("DELETE FROM blackout_windows WHERE id=$1", &[&blackout_id])
        .await?;
    Ok(())
}
