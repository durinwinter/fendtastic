use zenoh::prelude::*;
use zenoh::Session;
use tracing::{info, error};

pub async fn run(session: Session) {
    info!("Starting Zenoh subscriber");

    // Subscribe to all fendtastic topics
    let subscriber = session
        .declare_subscriber("fendtastic/**")
        .await
        .expect("Failed to create subscriber");

    info!("Subscribed to fendtastic/**");

    loop {
        let sample = subscriber.recv_async().await.expect("Subscriber error");

        let key = sample.key_expr().as_str();
        let payload = sample.payload().to_string();

        info!("Received [{}]: {}", key, payload);

        // Process received data
        process_sample(key, &payload).await;
    }
}

async fn process_sample(key: &str, payload: &str) {
    // Route messages to appropriate handlers based on key expression
    if key.starts_with("fendtastic/eva-ics/") {
        // Handle EVA-ICS data
        info!("Processing EVA-ICS data: {}", key);
    } else if key.starts_with("fendtastic/commands/") {
        // Handle commands
        info!("Processing command: {}", key);
    }
}
