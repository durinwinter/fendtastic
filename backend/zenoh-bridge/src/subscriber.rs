use tracing::info;
use zenoh::Session;

pub async fn run(session: Session) {
    info!("Starting Zenoh subscriber");

    let subscriber = session
        .declare_subscriber("fendtastic/**")
        .await
        .expect("Failed to create subscriber");

    info!("Subscribed to fendtastic/**");

    loop {
        match subscriber.recv_async().await {
            Ok(sample) => {
                let key = sample.key_expr().as_str().to_string();
                let payload = sample
                    .payload()
                    .try_to_string()
                    .unwrap_or_else(|e| e.to_string().into())
                    .to_string();

                info!("Received [{}]: {}", key, payload);
                process_sample(&key, &payload).await;
            }
            Err(e) => {
                tracing::error!("Subscriber error: {}", e);
                break;
            }
        }
    }
}

async fn process_sample(key: &str, _payload: &str) {
    if key.starts_with("fendtastic/eva-ics/") {
        info!("Processing EVA-ICS data: {}", key);
    } else if key.starts_with("fendtastic/commands/") {
        info!("Processing command: {}", key);
    }
}
