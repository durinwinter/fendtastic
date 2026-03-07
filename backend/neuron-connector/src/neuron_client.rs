use async_trait::async_trait;
use shared::domain::driver::{DriverCatalogEntry, DriverInstance};
use shared::domain::runtime::{NeuronConnection, RuntimeNodeHealthCheck};

#[async_trait]
pub trait NeuronClient {
    async fn health_check(&self, conn: &NeuronConnection) -> anyhow::Result<Vec<RuntimeNodeHealthCheck>>;
    async fn list_drivers(&self, _conn: &NeuronConnection) -> anyhow::Result<Vec<DriverCatalogEntry>>;
    async fn create_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()>;
    async fn update_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()>;
    async fn start_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()>;
    async fn stop_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()>;
    async fn read_tag(&self, _conn: &NeuronConnection, _driver: &DriverInstance, _tag_id: &str) -> anyhow::Result<serde_json::Value>;
    async fn write_tag(&self, _conn: &NeuronConnection, _driver: &DriverInstance, _tag_id: &str, _value: serde_json::Value) -> anyhow::Result<()>;
}

pub struct StubNeuronClient;

#[async_trait]
impl NeuronClient for StubNeuronClient {
    async fn health_check(&self, conn: &NeuronConnection) -> anyhow::Result<Vec<RuntimeNodeHealthCheck>> {
        Ok(vec![RuntimeNodeHealthCheck {
            name: "stub".to_string(),
            ok: conn.base_url.starts_with("http"),
            message: "Stub Neuron health check".to_string(),
        }])
    }

    async fn list_drivers(&self, _conn: &NeuronConnection) -> anyhow::Result<Vec<DriverCatalogEntry>> {
        Ok(Vec::new())
    }

    async fn create_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()> { Ok(()) }
    async fn update_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()> { Ok(()) }
    async fn start_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()> { Ok(()) }
    async fn stop_driver(&self, _conn: &NeuronConnection, _driver: &DriverInstance) -> anyhow::Result<()> { Ok(()) }
    async fn read_tag(&self, _conn: &NeuronConnection, _driver: &DriverInstance, _tag_id: &str) -> anyhow::Result<serde_json::Value> { Ok(serde_json::json!(null)) }
    async fn write_tag(&self, _conn: &NeuronConnection, _driver: &DriverInstance, _tag_id: &str, _value: serde_json::Value) -> anyhow::Result<()> { Ok(()) }
}
