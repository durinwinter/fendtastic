use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverCatalogEntry {
    pub key: String,
    pub name: String,
    pub vendor: String,
    pub direction: DriverDirection,
    pub config_schema: serde_json::Value,
    pub tag_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DriverDirection {
    Southbound,
    Northbound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverInstance {
    pub id: String,
    pub runtime_node_id: String,
    pub pea_id: String,
    pub driver_key: String,
    pub display_name: String,
    pub state: DriverInstanceState,
    pub config: serde_json::Value,
    pub tag_groups: Vec<TagGroup>,
    pub last_error: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStatusSnapshot {
    pub driver_id: String,
    pub node_name: String,
    pub state: DriverInstanceState,
    pub remote_running: Option<bool>,
    pub remote_link: Option<i64>,
    pub remote_rtt: Option<i64>,
    pub last_error: Option<String>,
    pub last_read: Option<DriverOperationRecord>,
    pub last_write: Option<DriverOperationRecord>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverOperationRecord {
    pub tag_id: String,
    pub tag_name: String,
    pub value: serde_json::Value,
    pub ok: bool,
    pub message: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DriverInstanceState {
    Created,
    Configured,
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Vec<DriverTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverTag {
    pub id: String,
    pub name: String,
    pub address: String,
    pub data_type: DriverDataType,
    pub access: TagAccess,
    pub scan_ms: Option<u32>,
    pub attributes: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DriverDataType {
    Bool,
    Int16,
    Uint16,
    Int32,
    Uint32,
    Float32,
    Float64,
    String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TagAccess {
    Read,
    Write,
    ReadWrite,
}
