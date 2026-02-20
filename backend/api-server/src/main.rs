use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use tracing::{info, error, Level};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;

mod handlers;
mod mesh_handlers;
mod pea_handlers;
mod simulator;
mod state;
mod timeseries_handlers;
mod websocket;

use state::{AppState, TimeSeriesStore};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting Fendtastic API Server");

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

    let pea_config_dir = std::env::var("PEA_CONFIG_DIR")
        .unwrap_or_else(|_| "./data/pea-configs".to_string());

    let recipe_dir = std::env::var("RECIPE_DIR")
        .unwrap_or_else(|_| "./data/recipes".to_string());

    let pea_configs = pea_handlers::load_pea_configs(&pea_config_dir);
    let recipes = pea_handlers::load_recipes(&recipe_dir);

    // Time-series ring buffer: keep up to 86400 points per key (~24h at 1 sample/sec)
    let timeseries = Arc::new(RwLock::new(TimeSeriesStore::new(86400)));

    let app_state = web::Data::new(AppState {
        zenoh_session: Arc::new(zenoh_session),
        pea_configs: Arc::new(RwLock::new(pea_configs)),
        recipes: Arc::new(RwLock::new(recipes)),
        pea_config_dir,
        recipe_dir,
        timeseries: timeseries.clone(),
        running_sims: Arc::new(RwLock::new(HashMap::new())),
    });

    // Spawn background Zenoh subscriber to collect time-series data
    {
        let session = app_state.zenoh_session.clone();
        let ts_store = timeseries.clone();
        tokio::spawn(async move {
            let subscriber = match session.declare_subscriber("fendtastic/**").await {
                Ok(sub) => sub,
                Err(e) => {
                    error!("Failed to subscribe to fendtastic/** for time-series: {}", e);
                    return;
                }
            };
            info!("Time-series collector: subscribed to fendtastic/**");

            loop {
                match subscriber.recv_async().await {
                    Ok(sample) => {
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
                    Err(_) => break,
                }
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
                    .route("/timeseries/{machine_id}", web::get().to(handlers::get_timeseries))
                    // Time-series historical data
                    .route("/ts/keys", web::get().to(timeseries_handlers::get_ts_keys))
                    .route("/ts/query", web::get().to(timeseries_handlers::query_timeseries))
                    // PEA CRUD
                    .route("/pea", web::get().to(pea_handlers::list_peas))
                    .route("/pea", web::post().to(pea_handlers::create_pea))
                    .route("/pea/{id}", web::get().to(pea_handlers::get_pea))
                    .route("/pea/{id}", web::put().to(pea_handlers::update_pea))
                    .route("/pea/{id}", web::delete().to(pea_handlers::delete_pea))
                    // PEA Lifecycle
                    .route("/pea/{id}/deploy", web::post().to(pea_handlers::deploy_pea))
                    .route("/pea/{id}/start", web::post().to(pea_handlers::start_pea))
                    .route("/pea/{id}/stop", web::post().to(pea_handlers::stop_pea))
                    // Recipes
                    .route("/recipes", web::get().to(pea_handlers::list_recipes))
                    .route("/recipes", web::post().to(pea_handlers::create_recipe))
                    .route("/recipes/{id}/execute", web::post().to(pea_handlers::execute_recipe))
                    // Mesh / Zenoh Admin
                    .route("/mesh/nodes", web::get().to(mesh_handlers::get_nodes))
                    .route("/mesh/router", web::get().to(mesh_handlers::get_router_info))
                    .route("/mesh/links", web::get().to(mesh_handlers::get_links))
                    .route("/mesh/keys", web::get().to(mesh_handlers::get_keys))
                    .route("/mesh/keys/{key_expr:.*}", web::get().to(mesh_handlers::get_key_value))
                    .route("/mesh/config", web::post().to(mesh_handlers::update_config))
                    .route("/mesh/generate-config", web::post().to(mesh_handlers::generate_node_config))
                    // WebSocket
                    .route("/ws", web::get().to(websocket::ws_handler))
            )
    })
    .bind((&*host, port))?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "fendtastic-api-server"
    }))
}
