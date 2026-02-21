use tracing::{info, Level};

mod publisher;
mod subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    info!("Starting Zenoh Bridge");

    // Configure Zenoh session with router endpoint
    let mut config = zenoh::Config::default();
    config
        .insert_json5("connect/endpoints", r#"["tcp/127.0.0.1:7447"]"#)
        .expect("Failed to configure Zenoh endpoints");

    let session = zenoh::open(config).await.map_err(|e| anyhow::anyhow!(e))?;
    info!("Zenoh session opened");

    // Start publisher task
    let publisher_session = session.clone();
    let publisher_handle = tokio::spawn(async move { publisher::run(publisher_session).await });

    // Start subscriber task
    let subscriber_session = session.clone();
    let subscriber_handle = tokio::spawn(async move { subscriber::run(subscriber_session).await });

    // Wait for tasks or shutdown signal
    tokio::select! {
        _ = publisher_handle => info!("Publisher task ended"),
        _ = subscriber_handle => info!("Subscriber task ended"),
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
    }

    session.close().await.map_err(|e| anyhow::anyhow!(e))?;
    info!("Zenoh Bridge shut down");

    Ok(())
}
