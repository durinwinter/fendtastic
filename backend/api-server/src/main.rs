use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, Level};

mod db;
mod handlers;
mod mesh_handlers;
mod pea_handlers;
mod pol_handlers;
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
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://murph:murph@localhost:5432/murph".to_string()
    });

    let db_client = db::connect_and_migrate(&database_url)
        .await
        .expect("Failed to connect/migrate Postgres");

    let pea_configs = pea_handlers::load_pea_configs(&pea_config_dir);
    let recipes = pea_handlers::load_recipes(&recipe_dir);
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
            .service(
                web::scope("/api/v1")
                    // Dashboard endpoints
                    .route("/metrics", web::get().to(handlers::get_metrics))
                    .route("/machines", web::get().to(handlers::get_machines))
                    .route("/machines/{id}", web::get().to(handlers::get_machine_by_id))
                    .route("/alarms", web::get().to(handlers::get_alarms))
                    .route("/alarms/{id}/ack", web::post().to(pol_handlers::ack_alarm))
                    .route(
                        "/alarms/{id}/shelve",
                        web::post().to(pol_handlers::shelve_alarm),
                    )
                    .route(
                        "/alarms/{id}/action",
                        web::post().to(pol_handlers::action_alarm),
                    )
                    .route("/alarms/{id}", web::delete().to(pol_handlers::delete_alarm))
                    .route(
                        "/alarm-rules",
                        web::get().to(pol_handlers::list_alarm_rules),
                    )
                    .route(
                        "/alarm-rules",
                        web::post().to(pol_handlers::create_alarm_rule),
                    )
                    .route(
                        "/alarm-rules/{id}",
                        web::put().to(pol_handlers::update_alarm_rule),
                    )
                    .route(
                        "/alarm-rules/{id}",
                        web::delete().to(pol_handlers::delete_alarm_rule),
                    )
                    .route("/blackouts", web::get().to(pol_handlers::list_blackouts))
                    .route("/blackouts", web::post().to(pol_handlers::create_blackout))
                    .route(
                        "/blackouts/{id}",
                        web::delete().to(pol_handlers::delete_blackout),
                    )
                    .route(
                        "/timeseries/{machine_id}",
                        web::get().to(handlers::get_timeseries),
                    )
                    // Time-series historical data
                    .route("/ts/keys", web::get().to(timeseries_handlers::get_ts_keys))
                    .route(
                        "/ts/query",
                        web::get().to(timeseries_handlers::query_timeseries),
                    )
                    .route(
                        "/ts/latest",
                        web::get().to(timeseries_handlers::get_ts_latest),
                    )
                    // PEA CRUD
                    .route("/pea", web::get().to(pea_handlers::list_peas))
                    .route("/pea", web::post().to(pea_handlers::create_pea))
                    .route("/pea/{id}", web::get().to(pea_handlers::get_pea))
                    .route("/pea/{id}", web::put().to(pea_handlers::update_pea))
                    .route("/pea/{id}", web::delete().to(pea_handlers::delete_pea))
                    // PEA Lifecycle
                    .route("/pea/{id}/deploy", web::post().to(pea_handlers::deploy_pea))
                    .route(
                        "/pea/{id}/undeploy",
                        web::post().to(pea_handlers::undeploy_pea),
                    )
                    .route("/pea/{id}/start", web::post().to(pea_handlers::start_pea))
                    .route("/pea/{id}/stop", web::post().to(pea_handlers::stop_pea))
                    .route(
                        "/pea/{id}/services/{service_tag}/command",
                        web::post().to(pea_handlers::command_service),
                    )
                    // Recipes
                    .route("/recipes", web::get().to(pea_handlers::list_recipes))
                    .route("/recipes", web::post().to(pea_handlers::create_recipe))
                    .route("/recipes/{id}", web::put().to(pea_handlers::update_recipe))
                    .route(
                        "/recipes/{id}",
                        web::delete().to(pea_handlers::delete_recipe),
                    )
                    .route(
                        "/recipes/{id}/execute",
                        web::post().to(pea_handlers::execute_recipe),
                    )
                    .route(
                        "/recipes/executions",
                        web::get().to(pea_handlers::list_recipe_executions),
                    )
                    .route(
                        "/recipes/executions/{id}",
                        web::get().to(pea_handlers::get_recipe_execution),
                    )
                    // POL topology
                    .route("/pol/topology", web::get().to(pol_handlers::get_topology))
                    .route("/pol/topology", web::put().to(pol_handlers::put_topology))
                    // Mesh / Zenoh Admin
                    .route("/mesh/nodes", web::get().to(mesh_handlers::get_nodes))
                    .route(
                        "/mesh/router",
                        web::get().to(mesh_handlers::get_router_info),
                    )
                    .route("/mesh/links", web::get().to(mesh_handlers::get_links))
                    .route("/mesh/keys", web::get().to(mesh_handlers::get_keys))
                    .route(
                        "/mesh/keys/{key_expr:.*}",
                        web::get().to(mesh_handlers::get_key_value),
                    )
                    .route("/mesh/config", web::post().to(mesh_handlers::update_config))
                    .route(
                        "/mesh/generate-config",
                        web::post().to(mesh_handlers::generate_node_config),
                    )
                    // Simulator
                    .route(
                        "/simulator/start",
                        web::post().to(simulator::start_standalone),
                    )
                    .route(
                        "/simulator/scenarios",
                        web::get().to(simulator::list_scenarios),
                    )
                    .route(
                        "/simulator/stop",
                        web::post().to(simulator::stop_standalone),
                    )
                    .route("/simulator/status", web::get().to(simulator::get_status))
                    // Durins-Forge Scenario Launcher
                    .route(
                        "/scenarios",
                        web::get().to(scenario_handlers::list_scenarios),
                    )
                    .route(
                        "/scenarios/launch",
                        web::post().to(scenario_handlers::launch_scenario),
                    )
                    .route(
                        "/scenarios/{run_id}/status",
                        web::get().to(scenario_handlers::get_scenario_status),
                    )
                    .route(
                        "/scenarios/running",
                        web::get().to(scenario_handlers::list_running_scenarios),
                    )
                    // WebSocket
                    .route("/ws", web::get().to(websocket::ws_handler)),
            )
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
