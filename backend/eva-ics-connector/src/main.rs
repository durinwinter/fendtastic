use tracing::{info, error, Level};
use std::time::Duration;
use tokio::time;

mod eva_client;
mod bridge;

use eva_client::EvaIcsClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting EVA-ICS Connector");

    // Get EVA-ICS configuration from environment
    let eva_url = std::env::var("EVA_ICS_URL")
        .unwrap_or_else(|_| "http://localhost:7727".to_string());
    let eva_api_key = std::env::var("EVA_ICS_API_KEY")
        .unwrap_or_else(|_| "default-key".to_string());

    // Initialize EVA-ICS client
    let eva_client = EvaIcsClient::new(eva_url, eva_api_key);

    // Initialize Zenoh session
    let mut zenoh_config = zenoh::Config::default();
    zenoh_config.connect.endpoints.set(vec!["tcp/127.0.0.1:7447".parse().unwrap()])?;
    let zenoh_session = zenoh::open(zenoh_config).await?;

    info!("EVA-ICS Connector initialized");

    // Start bridge loop
    loop {
        if let Err(e) = bridge::sync_sensors(&eva_client, &zenoh_session).await {
            error!("Error syncing sensors: {}", e);
        }

        time::sleep(Duration::from_millis(500)).await;
    }
}
