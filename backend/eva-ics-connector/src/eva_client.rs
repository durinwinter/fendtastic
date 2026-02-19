use reqwest::Client;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use tracing::error;

#[derive(Clone)]
pub struct EvaIcsClient {
    base_url: String,
    api_key: String,
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SensorData {
    pub oid: String,
    pub status: i32,
    pub value: Option<serde_json::Value>,
    pub t: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct JrpcRequest {
    jsonrpc: String,
    id: u32,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct JrpcResponse {
    result: Option<serde_json::Value>,
    error: Option<serde_json::Value>,
}

impl EvaIcsClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            client: Client::new(),
        }
    }

    async fn call_jrpc(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value> {
        let url = format!("{}/jrpc", self.base_url);

        let request = JrpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: method.to_string(),
            params,
        };

        let response = self.client
            .post(&url)
            .header("X-Auth-Key", &self.api_key)
            .json(&request)
            .send()
            .await?;

        let result: JrpcResponse = response.json().await?;

        if let Some(err) = result.error {
            return Err(anyhow::anyhow!("EVA-ICS API error: {}", err));
        }

        Ok(result.result.unwrap_or(serde_json::Value::Null))
    }

    // ─── Item State Operations ───────────────────────────────────────────────

    pub async fn get_sensor_state(&self, oid: &str) -> Result<SensorData> {
        let result = self.call_jrpc("item.state", serde_json::json!({"i": oid})).await?;
        let sensor: SensorData = serde_json::from_value(result)?;
        Ok(sensor)
    }

    pub async fn list_sensors(&self) -> Result<Vec<SensorData>> {
        let result = self.call_jrpc("item.state", serde_json::json!({"i": "#"})).await?;
        let sensors: Vec<SensorData> = serde_json::from_value(result).unwrap_or_default();
        Ok(sensors)
    }

    pub async fn get_item_states(&self, oid_mask: &str) -> Result<Vec<SensorData>> {
        let result = self.call_jrpc("item.state", serde_json::json!({"i": oid_mask})).await?;
        let items: Vec<SensorData> = serde_json::from_value(result).unwrap_or_default();
        Ok(items)
    }

    // ─── Item Actions ────────────────────────────────────────────────────────

    pub async fn set_unit_action(&self, oid: &str, value: serde_json::Value) -> Result<()> {
        self.call_jrpc("action", serde_json::json!({"i": oid, "value": value})).await?;
        Ok(())
    }

    // ─── Item Deployment ─────────────────────────────────────────────────────

    pub async fn deploy_items(&self, items: Vec<serde_json::Value>) -> Result<()> {
        self.call_jrpc("item.deploy", serde_json::json!({"items": items})).await?;
        Ok(())
    }

    pub async fn undeploy_items(&self, oids: Vec<String>) -> Result<()> {
        let items: Vec<serde_json::Value> = oids.iter()
            .map(|o| serde_json::json!({"oid": o}))
            .collect();
        self.call_jrpc("item.undeploy", serde_json::json!({"items": items})).await?;
        Ok(())
    }

    pub async fn create_item(&self, oid: &str) -> Result<()> {
        self.call_jrpc("item.create", serde_json::json!({"i": oid})).await?;
        Ok(())
    }

    pub async fn set_item_state(&self, oid: &str, status: i32, value: serde_json::Value) -> Result<()> {
        self.call_jrpc("lvar.set", serde_json::json!({
            "i": oid,
            "status": status,
            "value": value
        })).await?;
        Ok(())
    }

    // ─── Service Deployment ──────────────────────────────────────────────────

    pub async fn deploy_service(&self, svc_config: serde_json::Value) -> Result<()> {
        self.call_jrpc("svc.deploy", svc_config).await?;
        Ok(())
    }

    pub async fn undeploy_service(&self, svc_id: &str) -> Result<()> {
        self.call_jrpc("svc.undeploy", serde_json::json!({"svcs": [svc_id]})).await?;
        Ok(())
    }

    // ─── Health Check ────────────────────────────────────────────────────────

    pub async fn is_available(&self) -> bool {
        match self.call_jrpc("test", serde_json::json!({})).await {
            Ok(_) => true,
            Err(e) => {
                error!("EVA-ICS not available: {}", e);
                false
            }
        }
    }
}
