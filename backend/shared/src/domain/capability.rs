use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityAdvertisement {
    pub runtime_node_id: String,
    pub pea_id: String,
    pub capabilities: Vec<CapabilityDeclaration>,
    pub interfaces: Vec<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityDeclaration {
    pub name: String,
    pub commands: Vec<String>,
    pub procedures: Vec<String>,
    pub measurements: Vec<String>,
    pub constraints: serde_json::Value,
}
