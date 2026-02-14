use reqwest::Client;
use serde::{Deserialize, Serialize};
use anyhow::Result;

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

#[derive(Debug, Serialize)]
struct EvaRequest {
    method: String,
    params: serde_json::Value,
}

impl EvaIcsClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            client: Client::new(),
        }
    }

    pub async fn get_sensor_state(&self, oid: &str) -> Result<SensorData> {
        let url = format!("{}/jrpc", self.base_url);

        let request = EvaRequest {
            method: "item.state".to_string(),
            params: serde_json::json!({
                "i": oid
            }),
        };

        let response = self.client
            .post(&url)
            .header("X-Auth-Key", &self.api_key)
            .json(&request)
            .send()
            .await?;

        let result: SensorData = response.json().await?;
        Ok(result)
    }

    pub async fn list_sensors(&self) -> Result<Vec<SensorData>> {
        let url = format!("{}/jrpc", self.base_url);

        let request = EvaRequest {
            method: "item.state".to_string(),
            params: serde_json::json!({
                "i": "#"
            }),
        };

        let response = self.client
            .post(&url)
            .header("X-Auth-Key", &self.api_key)
            .json(&request)
            .send()
            .await?;

        let result: Vec<SensorData> = response.json().await?;
        Ok(result)
    }

    pub async fn set_unit_action(&self, oid: &str, value: serde_json::Value) -> Result<()> {
        let url = format!("{}/jrpc", self.base_url);

        let request = EvaRequest {
            method: "action".to_string(),
            params: serde_json::json!({
                "i": oid,
                "value": value
            }),
        };

        self.client
            .post(&url)
            .header("X-Auth-Key", &self.api_key)
            .json(&request)
            .send()
            .await?;

        Ok(())
    }
}
