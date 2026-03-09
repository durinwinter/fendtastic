use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use shared::domain::driver::DriverInstance;
use std::sync::Arc;

/// Unified result for reading a single tag value from any backend.
#[derive(Debug, Clone)]
pub struct TagReadResult {
    pub name: String,
    pub value: Option<Value>,
    pub error: Option<i64>,
}

/// Connection/running status reported by the backend.
#[derive(Debug, Clone)]
pub struct BackendDriverState {
    pub running: bool,
    pub link: Option<i64>,
    pub rtt: Option<i64>,
}

/// A tag as reported by the remote system during browse.
#[derive(Debug, Clone)]
pub struct BrowseTag {
    pub name: String,
    pub address: Option<String>,
    pub data_type: Option<i32>,
    pub attribute: Option<i32>,
    pub description: Option<String>,
}

/// A group of tags from a browse operation.
#[derive(Debug, Clone)]
pub struct BrowseGroup {
    pub name: String,
    pub interval: Option<u64>,
    pub tags: Vec<BrowseTag>,
}

#[async_trait]
pub trait DriverBackend: Send + Sync {
    /// Synchronize driver config + tags to the backend.
    /// For native backends this is typically a no-op.
    async fn sync_driver(&self, driver: &DriverInstance) -> Result<()>;

    /// Start the driver (connect to PLC / start Neuron node).
    async fn start_driver(&self, driver: &DriverInstance) -> Result<()>;

    /// Stop the driver (disconnect from PLC / stop Neuron node).
    async fn stop_driver(&self, driver: &DriverInstance) -> Result<()>;

    /// Get current connection/running state.
    async fn get_driver_state(&self, driver: &DriverInstance) -> Result<Option<BackendDriverState>>;

    /// Read a single tag by group name + tag name.
    async fn read_tag(&self, driver: &DriverInstance, group: &str, tag_name: &str) -> Result<TagReadResult>;

    /// Write a single tag by group name + tag name.
    async fn write_tag(&self, driver: &DriverInstance, group: &str, tag_name: &str, value: Value) -> Result<()>;

    /// Browse tags as configured in the remote system.
    async fn browse_tags(&self, driver: &DriverInstance) -> Result<Vec<BrowseGroup>>;

    /// Return a display name for the node in status snapshots.
    fn node_name(&self, driver: &DriverInstance) -> String;
}

/// Resolve the appropriate backend for a given driver.
pub fn resolve_backend(
    driver: &DriverInstance,
    runtime_node: Option<&shared::domain::runtime::RuntimeNode>,
    native_s7_registry: &Arc<crate::native_s7_backend::NativeS7Registry>,
) -> Result<Arc<dyn DriverBackend>> {
    match driver.driver_key.as_str() {
        "siemens-s7" => {
            let node = runtime_node
                .ok_or_else(|| anyhow::anyhow!("Neuron backend requires a RuntimeNode"))?;
            Ok(Arc::new(crate::neuron_backend::NeuronBackend::new(
                node.neuron.clone(),
            )))
        }
        "siemens-s7-native" => Ok(Arc::new(crate::native_s7_backend::NativeS7Backend::new(
            native_s7_registry.clone(),
        ))),
        other => Err(anyhow::anyhow!("No backend available for driver_key: {}", other)),
    }
}
