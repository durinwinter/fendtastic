use crate::eva_client::EvaIcsClient;
use zenoh::Session;
use tracing::{info, error};
use anyhow::Result;
use chrono;

pub async fn sync_sensors(eva_client: &EvaIcsClient, zenoh_session: &Session) -> Result<()> {
    // Fetch all sensor states from EVA-ICS
    let sensors = eva_client.list_sensors().await?;

    for sensor in sensors {
        let key = format!("fendtastic/eva-ics/sensors/{}", sensor.oid);

        let payload = serde_json::json!({
            "oid": sensor.oid,
            "status": sensor.status,
            "value": sensor.value,
            "timestamp": sensor.t
        });

        // Publish to Zenoh
        zenoh_session
            .put(&key, payload.to_string())
            .await
            .map_err(|e| anyhow::anyhow!(e))?;
    }

    // Publish status
    let status_payload = serde_json::json!({
        "online": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    zenoh_session
        .put("fendtastic/status/eva-ics", status_payload.to_string())
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    Ok(())
}

pub async fn handle_command(
    eva_client: &EvaIcsClient,
    oid: &str,
    value: serde_json::Value,
) -> Result<()> {
    info!("Sending command to EVA-ICS: {} = {:?}", oid, value);
    eva_client.set_unit_action(oid, value).await?;
    Ok(())
}
