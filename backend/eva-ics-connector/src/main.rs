use tracing::{error, info, Level};
use std::time::Duration;
use tokio::time;

mod eva_client;
mod bridge;
mod pea_deployer;

use eva_client::EvaIcsClient;
use bridge::PeaBridge;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting EVA-ICS Connector");

    let eva_url = std::env::var("EVA_ICS_URL")
        .unwrap_or_else(|_| "http://localhost:7727".to_string());
    let eva_api_key = std::env::var("EVA_ICS_API_KEY")
        .unwrap_or_else(|_| "default-key".to_string());

    let eva_client = EvaIcsClient::new(eva_url, eva_api_key);

    // Configure Zenoh session with router endpoint
    let zenoh_endpoint = std::env::var("ZENOH_ROUTER")
        .unwrap_or_else(|_| "tcp/127.0.0.1:7447".to_string());
    let mut zenoh_config = zenoh::Config::default();
    zenoh_config
        .insert_json5("connect/endpoints", &format!(r#"["{}"]"#, zenoh_endpoint))
        .expect("Failed to configure Zenoh endpoints");
    let zenoh_session = zenoh::open(zenoh_config).await.map_err(|e| anyhow::anyhow!(e))?;

    info!("EVA-ICS Connector initialized");

    // Create PeaBridge for PEA lifecycle management
    let pea_bridge = PeaBridge::new(eva_client.clone(), zenoh_session.clone());

    // Spawn command listener (deploy/lifecycle/service commands via Zenoh)
    let bridge_handle = tokio::spawn(async move {
        if let Err(e) = pea_bridge.run_command_listener().await {
            error!("PeaBridge command listener error: {}", e);
        }
    });

    // Legacy sensor sync loop (backward compat with Dashboard)
    let sensor_sync_handle = tokio::spawn(async move {
        loop {
            if let Err(e) = bridge::sync_sensors(&eva_client, &zenoh_session).await {
                error!("Error syncing sensors: {}", e);
            }
            time::sleep(Duration::from_millis(500)).await;
        }
    });

    tokio::select! {
        _ = bridge_handle => info!("PeaBridge command listener ended"),
        _ = sensor_sync_handle => info!("Sensor sync loop ended"),
    }

    Ok(())
}
