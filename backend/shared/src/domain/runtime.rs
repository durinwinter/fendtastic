use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeNode {
    pub id: String,
    pub name: String,
    pub architecture: RuntimeArchitecture,
    pub host: String,
    pub neuron: NeuronConnection,
    pub assigned_pea_id: Option<String>,
    pub status: RuntimeNodeStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuntimeArchitecture {
    Arm64,
    ArmV7,
    Amd64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeuronConnection {
    pub base_url: String,
    pub username: Option<String>,
    pub password_ref: Option<String>,
    pub config_path: Option<String>,
    pub mode: NeuronAccessMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NeuronAccessMode {
    Api,
    FileExport,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeNodeStatus {
    Unknown,
    Offline,
    Online,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeNodeHealthCheck {
    pub name: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeNodeStatusSnapshot {
    pub runtime_node_id: String,
    pub status: RuntimeNodeStatus,
    pub checks: Vec<RuntimeNodeHealthCheck>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
