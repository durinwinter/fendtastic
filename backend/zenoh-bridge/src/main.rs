use tracing::{info, error, Level};
use zenoh::prelude::*;
use std::time::Duration;
use tokio::time;

mod publisher;
mod subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting Zenoh Bridge");

    // Configure Zenoh session
    let mut config = zenoh::Config::default();
    // Connect to Zenoh router
    config.connect.endpoints.set(vec!["tcp/127.0.0.1:7447".parse().unwrap()])?;

    let session = zenoh::open(config).await?;
    info!("Zenoh session opened");

    // Start publisher task
    let publisher_session = session.clone();
    let publisher_handle = tokio::spawn(async move {
        publisher::run(publisher_session).await
    });

    // Start subscriber task
    let subscriber_session = session.clone();
    let subscriber_handle = tokio::spawn(async move {
        subscriber::run(subscriber_session).await
    });

    // Wait for tasks
    tokio::select! {
        _ = publisher_handle => info!("Publisher task ended"),
        _ = subscriber_handle => info!("Subscriber task ended"),
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
    }

    session.close().await?;
    info!("Zenoh Bridge shut down");

    Ok(())
}
