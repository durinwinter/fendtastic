use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use chrono::Utc;
use shared::domain::driver::{DriverInstance, DriverStatusSnapshot};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, Level};

mod api_routes;
mod authority_handlers;
mod authority_service;
mod binding_handlers;
mod binding_validation;
mod control_plane_status;
mod db;
mod driver_catalog;
mod driver_handlers;
mod handlers;
mod i3x_handlers;
mod mesh_handlers;
mod neuron_client;
mod pea_handlers;
mod pol_handlers;
mod runtime_handlers;
mod runtime_status;
mod runtime_store;
mod scenario_handlers;
mod simulator;
mod state;
mod timeseries_handlers;
mod websocket;

use state::{AppState, TimeSeriesStore};

async fn ingest_timeseries_sample(
    sample: zenoh::sample::Sample,
    ts_store: Arc<RwLock<TimeSeriesStore>>,
) {
    let key = sample.key_expr().as_str().to_string();
    let payload_str = sample
        .payload()
        .try_to_string()
        .unwrap_or_else(|e| e.to_string().into())
        .to_string();
    let value = serde_json::from_str::<serde_json::Value>(&payload_str)
        .unwrap_or(serde_json::Value::String(payload_str));
    let now_ms = chrono::Utc::now().timestamp_millis();

    let mut store = ts_store.write().await;
    store.insert(key, value, now_ms);
}

fn default_driver_status_snapshot(driver: &DriverInstance) -> DriverStatusSnapshot {
    DriverStatusSnapshot {
        driver_id: driver.id.clone(),
        node_name: neuron_client::neuron_node_name(driver),
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

fn driver_status_topic(driver: &DriverInstance) -> String {
    format!(
        "murph/runtime/nodes/{}/drivers/{}/status",
        driver.runtime_node_id, driver.id
    )
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    info!("Starting MURPH API Server");

    // Configure Zenoh session — use ZENOH_ROUTER env var if set
    let zenoh_session = {
        let mut config = zenoh::Config::default();
        if let Ok(endpoint) = std::env::var("ZENOH_ROUTER") {
            info!("Connecting to Zenoh router: {}", endpoint);
            config
                .insert_json5("connect/endpoints", &format!(r#"["{}"]"#, endpoint))
                .expect("Failed to configure Zenoh endpoints");
        }
        zenoh::open(config)
            .await
            .expect("Failed to open Zenoh session")
    };

    let pea_config_dir =
        std::env::var("PEA_CONFIG_DIR").unwrap_or_else(|_| "./data/pea-configs".to_string());

    let recipe_dir = std::env::var("RECIPE_DIR").unwrap_or_else(|_| "./data/recipes".to_string());
    let pol_db_dir = std::env::var("POL_DB_DIR").unwrap_or_else(|_| "./data/pol".to_string());
    let runtime_node_dir =
        std::env::var("RUNTIME_NODE_DIR").unwrap_or_else(|_| "./data/runtime-nodes".to_string());
    let driver_dir = std::env::var("DRIVER_DIR").unwrap_or_else(|_| "./data/drivers".to_string());
    let binding_dir =
        std::env::var("BINDING_DIR").unwrap_or_else(|_| "./data/bindings".to_string());
    let authority_dir =
        std::env::var("AUTHORITY_DIR").unwrap_or_else(|_| "./data/authority".to_string());
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://murph:murph@localhost:5432/murph".to_string()
    });

    let db_client = db::connect_and_migrate(&database_url)
        .await
        .expect("Failed to connect/migrate Postgres");

    let pea_configs = pea_handlers::load_pea_configs(&pea_config_dir);
    let recipes = pea_handlers::load_recipes(&recipe_dir);
    let runtime_nodes = runtime_store::load_map(&runtime_node_dir);
    let driver_instances = runtime_store::load_map(&driver_dir);
    let pea_bindings = runtime_store::load_map(&binding_dir);
    let authority_states = runtime_store::load_map(&authority_dir);
    let alarms = db::load_alarms(&db_client).await.unwrap_or_default();
    let topology = db::load_topology(&db_client).await.unwrap_or_default();
    let alarm_rules = db::load_alarm_rules(&db_client).await.unwrap_or_default();
    let blackout_windows = db::load_blackouts(&db_client).await.unwrap_or_default();

    // Time-series ring buffer: keep up to 86400 points per key (~24h at 1 sample/sec)
    let timeseries = Arc::new(RwLock::new(TimeSeriesStore::new(86400)));

    let app_state = web::Data::new(AppState {
        zenoh_session: Arc::new(zenoh_session),
        pea_configs: Arc::new(RwLock::new(pea_configs)),
        recipes: Arc::new(RwLock::new(recipes)),
        runtime_nodes: Arc::new(RwLock::new(runtime_nodes)),
        driver_instances: Arc::new(RwLock::new(driver_instances)),
        driver_statuses: Arc::new(RwLock::new(HashMap::new())),
        pea_bindings: Arc::new(RwLock::new(pea_bindings)),
        authority_states: Arc::new(RwLock::new(authority_states)),
        authority_audit: Arc::new(RwLock::new(Vec::new())),
        driver_catalog: Arc::new(RwLock::new(driver_catalog::built_in_catalog())),
        recipe_executions: Arc::new(RwLock::new(HashMap::new())),
        scenario_runs: Arc::new(RwLock::new(HashMap::new())),
        alarms: Arc::new(RwLock::new(alarms)),
        alarm_rules: Arc::new(RwLock::new(alarm_rules)),
        blackout_windows: Arc::new(RwLock::new(blackout_windows)),
        topology: Arc::new(RwLock::new(topology)),
        db_client: Arc::new(db_client),
        pea_config_dir,
        recipe_dir,
        pol_db_dir,
        runtime_node_dir,
        driver_dir,
        binding_dir,
        authority_dir,
        timeseries: timeseries.clone(),
        running_sims: Arc::new(RwLock::new(HashMap::new())),
    });

    // Spawn background Zenoh subscriber to collect time-series data
    {
        let session = app_state.zenoh_session.clone();
        let ts_store = timeseries.clone();
        tokio::spawn(async move {
            // Subscribe to murph, durins-forge PEA, and standalone fendtastic simulator telemetry.
            // Note: We need separate subscriptions since Zenoh doesn't support OR patterns.
            let subscriber1 = match session.declare_subscriber("murph/**").await {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!(
                        "Failed to subscribe to murph/** for time-series: {}",
                        e
                    );
                    None
                }
            };

            let subscriber2 = match session.declare_subscriber("pea/**").await {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!("Failed to subscribe to pea/** for time-series: {}", e);
                    None
                }
            };
            let subscriber3 = match session.declare_subscriber("fendtastic/**").await {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!(
                        "Failed to subscribe to fendtastic/** for time-series: {}",
                        e
                    );
                    None
                }
            };

            if subscriber1.is_none() && subscriber2.is_none() && subscriber3.is_none() {
                error!("Failed to subscribe to any telemetry topics");
                return;
            }

            info!("Time-series collector: subscribed to murph/**, pea/**, and fendtastic/**");

            match (subscriber1, subscriber2, subscriber3) {
                (Some(sub1), Some(sub2), Some(sub3)) => loop {
                    tokio::select! {
                        Ok(sample) = sub1.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                        Ok(sample) = sub2.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                        Ok(sample) = sub3.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                    }
                },
                (Some(sub1), Some(sub2), None) => loop {
                    tokio::select! {
                        Ok(sample) = sub1.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                        Ok(sample) = sub2.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                    }
                },
                (Some(sub1), None, Some(sub3)) => loop {
                    tokio::select! {
                        Ok(sample) = sub1.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                        Ok(sample) = sub3.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                    }
                },
                (None, Some(sub2), Some(sub3)) => loop {
                    tokio::select! {
                        Ok(sample) = sub2.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                        Ok(sample) = sub3.recv_async() => ingest_timeseries_sample(sample, ts_store.clone()).await,
                    }
                },
                (Some(sub1), None, None) => loop {
                    if let Ok(sample) = sub1.recv_async().await {
                        ingest_timeseries_sample(sample, ts_store.clone()).await;
                    }
                },
                (None, Some(sub2), None) => loop {
                    if let Ok(sample) = sub2.recv_async().await {
                        ingest_timeseries_sample(sample, ts_store.clone()).await;
                    }
                },
                (None, None, Some(sub3)) => loop {
                    if let Ok(sample) = sub3.recv_async().await {
                        ingest_timeseries_sample(sample, ts_store.clone()).await;
                    }
                },
                (None, None, None) => return,
            }
        });
    }

    // Publish periodic control-plane heartbeat so the frontend knows runtime services are alive.
    {
        let session = app_state.zenoh_session.clone();
        let runtime_nodes = app_state.runtime_nodes.clone();
        let drivers = app_state.driver_instances.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
            loop {
                interval.tick().await;
                let now = chrono::Utc::now().to_rfc3339();
                let runtime_node_count = runtime_nodes.read().await.len();
                let driver_count = drivers.read().await.len();

                let _ = session
                    .put(
                        "murph/status/runtime-orchestrator",
                        control_plane_status::runtime_orchestrator_payload(
                            runtime_node_count,
                            driver_count,
                            &now,
                        )
                        .to_string(),
                    )
                    .await;
            }
        });
    }

    // Poll runtime nodes periodically so status flows onto Zenoh even without UI actions.
    {
        let state = app_state.clone();
        tokio::spawn(async move {
            let client = neuron_client::NeuronHttpClient::new();
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            loop {
                interval.tick().await;

                let runtime_nodes: Vec<_> = {
                    let guard = state.runtime_nodes.read().await;
                    guard.values().cloned().collect()
                };

                for runtime_node in runtime_nodes {
                    let snapshot =
                        runtime_status::collect_runtime_status_snapshot(&runtime_node, &client)
                            .await;

                    {
                        let mut nodes = state.runtime_nodes.write().await;
                        if let Some(node) = nodes.get_mut(&runtime_node.id) {
                            node.status = snapshot.status.clone();
                        }
                    }

                    let _ = state
                        .zenoh_session
                        .put(
                            &format!("murph/runtime/nodes/{}/status", runtime_node.id),
                            serde_json::to_string(&snapshot)
                                .unwrap_or_else(|_| "{}".to_string()),
                        )
                        .await;
                }
            }
        });
    }

    // Poll Neuron periodically so driver status stays fresh even without user actions.
    {
        let state = app_state.clone();
        tokio::spawn(async move {
            let client = neuron_client::NeuronHttpClient::new();
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            loop {
                interval.tick().await;

                let drivers: Vec<DriverInstance> = {
                    let guard = state.driver_instances.read().await;
                    guard.values().cloned().collect()
                };

                if drivers.is_empty() {
                    continue;
                }

                let runtime_nodes = {
                    let guard = state.runtime_nodes.read().await;
                    guard.clone()
                };

                for driver in drivers {
                    let Some(runtime_node) = runtime_nodes.get(&driver.runtime_node_id).cloned() else {
                        continue;
                    };

                    let mut snapshot = {
                        let statuses = state.driver_statuses.read().await;
                        statuses
                            .get(&driver.id)
                            .cloned()
                            .unwrap_or_else(|| default_driver_status_snapshot(&driver))
                    };

                    snapshot.node_name = neuron_client::neuron_node_name(&driver);
                    snapshot.state = driver.state.clone();
                    snapshot.last_error = driver.last_error.clone();

                    match client.get_node_state(&runtime_node.neuron, &driver).await {
                        Ok(Some(remote_state)) => {
                            snapshot.remote_running = Some(remote_state.running == 1);
                            snapshot.remote_link = Some(remote_state.link);
                            snapshot.remote_rtt = remote_state.rtt;
                        }
                        Ok(None) => {
                            snapshot.remote_running = None;
                            snapshot.remote_link = None;
                            snapshot.remote_rtt = None;
                        }
                        Err(err) => {
                            snapshot.remote_running = Some(false);
                            snapshot.last_error = Some(err.to_string());
                        }
                    }

                    snapshot.updated_at = chrono::Utc::now();
                    state
                        .driver_statuses
                        .write()
                        .await
                        .insert(driver.id.clone(), snapshot.clone());

                    let _ = state
                        .zenoh_session
                        .put(
                            &driver_status_topic(&driver),
                            serde_json::to_string(&snapshot)
                                .unwrap_or_else(|_| "{}".to_string()),
                        )
                        .await;
                }
            }
        });
    }

    // Keep alarm and topology state synchronized with Zenoh bus.
    {
        let session = app_state.zenoh_session.clone();
        let alarms_state = app_state.alarms.clone();
        let rules_state = app_state.alarm_rules.clone();
        let blackout_state = app_state.blackout_windows.clone();
        let topology_state = app_state.topology.clone();
        let db_client = app_state.db_client.clone();
        let pol_dir = app_state.pol_db_dir.clone();
        tokio::spawn(async move {
            let alarm_sub = match session
                .declare_subscriber("murph/habitat/nodes/*/pea/*/swimlane/alarm")
                .await
            {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!(
                        "Failed to subscribe to murph/habitat/nodes/*/pea/*/swimlane/alarm: {}",
                        e
                    );
                    None
                }
            };
            let alarm_action_sub = match session
                .declare_subscriber("murph/pol/alarm/action")
                .await
            {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!("Failed to subscribe to murph/pol/alarm/action: {}", e);
                    None
                }
            };
            let topology_sub = match session.declare_subscriber("murph/pol/topology").await {
                Ok(sub) => Some(sub),
                Err(e) => {
                    error!("Failed to subscribe to murph/pol/topology: {}", e);
                    None
                }
            };

            if alarm_sub.is_none() && alarm_action_sub.is_none() && topology_sub.is_none() {
                return;
            }

            match (alarm_sub, alarm_action_sub, topology_sub) {
                (Some(alarm_sub), Some(action_sub), Some(topo_sub)) => loop {
                    tokio::select! {
                        Ok(sample) = alarm_sub.recv_async() => {
                            let key = sample.key_expr().as_str().to_string();
                            let payload = sample.payload().try_to_string().unwrap_or_else(|e| e.to_string().into()).to_string();
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                                let active = v.get("active").and_then(|x| x.as_bool()).unwrap_or(false);
                                let alarm_text = v.get("alarm").and_then(|x| x.as_str()).unwrap_or_default();
                                if active && !alarm_text.is_empty() {
                                    let now = Utc::now();
                                    let rules: Vec<state::AlarmRule> = rules_state.read().await.values().cloned().collect();
                                    let blackouts: Vec<state::BlackoutWindow> = blackout_state.read().await.values().cloned().collect();
                                    let active_rules: Vec<_> = rules.iter().filter(|r| r.enabled).collect();

                                    let matched_rule = active_rules.iter().find(|rule| {
                                        key.contains(&rule.source_pattern) && alarm_text.contains(&rule.event_pattern)
                                    });

                                    if !active_rules.is_empty() && matched_rule.is_none() {
                                        continue;
                                    }

                                    let in_blackout = blackouts.iter().any(|b| {
                                        match (
                                            chrono::DateTime::parse_from_rfc3339(&b.starts_at),
                                            chrono::DateTime::parse_from_rfc3339(&b.ends_at),
                                        ) {
                                            (Ok(start), Ok(end)) => {
                                                let start_utc = start.with_timezone(&Utc);
                                                let end_utc = end.with_timezone(&Utc);
                                                let in_window = now >= start_utc && now <= end_utc;
                                                let in_scope = b.scope == "global" || key.contains(&b.scope);
                                                in_window && in_scope
                                            }
                                            _ => false,
                                        }
                                    });

                                    let mut changed_alarm: Option<state::AlarmRecord> = None;
                                    {
                                        let mut alarms = alarms_state.write().await;
                                        let existing_id = alarms.iter()
                                            .find(|(_, a)| a.source == key && a.event == alarm_text && a.status != "cleared")
                                            .map(|(id, _)| id.clone());
                                        if let Some(id) = existing_id {
                                            if let Some(existing) = alarms.get_mut(&id) {
                                                existing.duplicate_count += 1;
                                                existing.timestamp = Utc::now().to_rfc3339();
                                                existing.value = v.get("value").map(|x| x.to_string()).unwrap_or_default();
                                                changed_alarm = Some(existing.clone());
                                            }
                                        } else {
                                            let id = uuid::Uuid::new_v4().to_string();
                                            let alarm = state::AlarmRecord {
                                                id,
                                                severity: matched_rule
                                                    .map(|r| r.severity.clone())
                                                    .unwrap_or_else(|| v.get("severity").and_then(|x| x.as_str()).unwrap_or("warning").to_string()),
                                                status: if in_blackout { "shelved".to_string() } else { "open".to_string() },
                                                source: key.clone(),
                                                event: alarm_text.to_string(),
                                                value: v.get("value").map(|x| x.to_string()).unwrap_or_default(),
                                                description: if in_blackout {
                                                    format!("Live alarm from {} (blackout active)", key)
                                                } else {
                                                    format!("Live alarm from {}", key)
                                                },
                                                timestamp: v.get("timestamp").and_then(|x| x.as_str()).unwrap_or(&Utc::now().to_rfc3339()).to_string(),
                                                duplicate_count: 1,
                                            };
                                            alarms.insert(alarm.id.clone(), alarm.clone());
                                            changed_alarm = Some(alarm);
                                        }
                                        pol_handlers::persist_alarms(&pol_dir, &alarms);
                                    }
                                    if let Some(changed) = changed_alarm {
                                        let _ = pol_handlers::upsert_alarm_db(&db_client, &changed).await;
                                    }
                                }
                            }
                        }
                        Ok(sample) = action_sub.recv_async() => {
                            let payload = sample.payload().try_to_string().unwrap_or_else(|e| e.to_string().into()).to_string();
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                                if let (Some(alarm_id), Some(action)) = (
                                    v.get("alarm_id").and_then(|x| x.as_str()),
                                    v.get("action").and_then(|x| x.as_str()),
                                ) {
                                    let mut db_alarm_update: Option<state::AlarmRecord> = None;
                                    let mut db_alarm_delete = false;
                                    {
                                        let mut alarms = alarms_state.write().await;
                                        if action == "delete" {
                                            alarms.remove(alarm_id);
                                            db_alarm_delete = true;
                                        } else if let Some(alarm) = alarms.get_mut(alarm_id) {
                                            alarm.status = action.to_string();
                                            db_alarm_update = Some(alarm.clone());
                                        }
                                        pol_handlers::persist_alarms(&pol_dir, &alarms);
                                    }
                                    if db_alarm_delete {
                                        let _ = pol_handlers::delete_alarm_db(&db_client, alarm_id).await;
                                    } else if let Some(updated_alarm) = db_alarm_update {
                                        let _ = pol_handlers::upsert_alarm_db(&db_client, &updated_alarm).await;
                                    }
                                }
                            }
                        }
                        Ok(sample) = topo_sub.recv_async() => {
                            let payload = sample.payload().try_to_string().unwrap_or_else(|e| e.to_string().into()).to_string();
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                                if let Some(edges_v) = v.get("edges") {
                                    if let Ok(edges) = serde_json::from_value::<Vec<state::PolEdge>>(edges_v.clone()) {
                                        let topology = state::PolTopology {
                                            edges,
                                            updated_at: v.get("updated_at").and_then(|x| x.as_str()).unwrap_or(&Utc::now().to_rfc3339()).to_string(),
                                        };
                                        {
                                            let mut t = topology_state.write().await;
                                            *t = topology.clone();
                                        }
                                        pol_handlers::persist_topology(&pol_dir, &topology);
                                        let _ = pol_handlers::upsert_topology_db(&db_client, &topology).await;
                                    }
                                }
                            }
                        }
                    }
                },
                _ => {}
            }
        });
    }

    let host = std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("API_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("API_PORT must be a valid port number");

    info!("Starting HTTP server on {}:{}", host, port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(app_state.clone())
            .route("/health", web::get().to(health_check))
            .service(web::scope("/api/v1").configure(api_routes::configure_api))
    })
    .bind((&*host, port))?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "murph-api-server"
    }))
}
