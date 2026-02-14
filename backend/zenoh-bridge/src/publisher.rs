use chrono::Utc;
use serde_json::json;
use std::time::Duration;
use tokio::time;
use tracing::{error, info};
use zenoh::Session;

pub async fn run(session: Session) {
    info!("Starting Zenoh publisher");

    loop {
        if let Err(e) = publish_telemetry(&session).await {
            error!("Failed to publish telemetry: {}", e);
        }

        time::sleep(Duration::from_millis(100)).await;
    }
}

async fn publish_telemetry(session: &Session) -> Result<(), Box<dyn std::error::Error>> {
    let timestamp = Utc::now().to_rfc3339();

    let machine_state = json!({
        "machine_id": "machine-001",
        "state": "operational",
        "timestamp": timestamp
    });

    session
        .put("fendtastic/machines/machine-001/state", machine_state.to_string())
        .await?;

    let sensor_data = json!({
        "machine_id": "machine-001",
        "sensor_id": "temp-001",
        "value": 72.5,
        "unit": "celsius",
        "timestamp": timestamp
    });

    session
        .put("fendtastic/sensors/machine-001/temp-001", sensor_data.to_string())
        .await?;

    Ok(())
}
