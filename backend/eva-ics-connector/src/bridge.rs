use crate::eva_client::EvaIcsClient;
use zenoh::Session;
use tracing::{info, error};
use anyhow::Result;

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
            .await?;
    }

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
