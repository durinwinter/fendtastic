use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use tracing::{info, Level};
use std::sync::Arc;
use tokio::sync::RwLock;

mod handlers;
mod state;
mod websocket;

use state::AppState;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting Fendtastic API Server");

    let zenoh_session = zenoh::open(zenoh::Config::default())
        .await
        .expect("Failed to open Zenoh session");

    let app_state = web::Data::new(AppState {
        zenoh_session: Arc::new(zenoh_session),
        connections: Arc::new(RwLock::new(0)),
    });

    info!("Starting HTTP server on 0.0.0.0:8080");

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
                    .route("/metrics", web::get().to(handlers::get_metrics))
                    .route("/machines", web::get().to(handlers::get_machines))
                    .route("/machines/{id}", web::get().to(handlers::get_machine_by_id))
                    .route("/alarms", web::get().to(handlers::get_alarms))
                    .route("/timeseries/{machine_id}", web::get().to(handlers::get_timeseries))
                    .route("/ws", web::get().to(websocket::ws_handler))
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "fendtastic-api-server"
    }))
}
