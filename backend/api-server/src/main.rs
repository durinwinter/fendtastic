use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use tracing::{info, Level};
use std::sync::Arc;
use tokio::sync::RwLock;

mod handlers;
mod pea_handlers;
mod state;
mod websocket;

use state::AppState;

#[actix_web::main]
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

    let app_state = web::Data::new(AppState {
        zenoh_session: Arc::new(zenoh_session),
        connections: Arc::new(RwLock::new(0)),
        pea_configs: Arc::new(RwLock::new(pea_configs)),
        recipes: Arc::new(RwLock::new(recipes)),
        pea_config_dir,
        recipe_dir,
    });

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
