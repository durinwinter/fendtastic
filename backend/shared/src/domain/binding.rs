use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeaBinding {
    pub id: String,
    pub pea_id: String,
    pub runtime_node_id: String,
    pub driver_instance_id: String,
    pub mappings: Vec<TagBinding>,
    pub validation: BindingValidationSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagBinding {
    pub canonical_tag: String,
    pub driver_tag_id: String,
    pub direction: BindingDirection,
    pub transform: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BindingDirection {
    ReadFromDriver,
    WriteToDriver,
    Bidirectional,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BindingValidationSummary {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
