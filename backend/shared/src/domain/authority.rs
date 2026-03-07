use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityState {
    pub pea_id: String,
    pub mode: ControlAuthorityMode,
    pub owner_actor_id: Option<String>,
    pub owner_actor_class: Option<ActorClass>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityChangeRequest {
    pub mode: ControlAuthorityMode,
    pub owner_actor_id: Option<String>,
    pub owner_actor_class: Option<ActorClass>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityAuditRecord {
    pub pea_id: String,
    pub mode: ControlAuthorityMode,
    pub owner_actor_id: Option<String>,
    pub owner_actor_class: Option<ActorClass>,
    pub changed_at: chrono::DateTime<chrono::Utc>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControlAuthorityMode {
    ObserveOnly,
    OperatorExclusive,
    AutoExclusive,
    AIAssisted,
    AIExclusive,
    MaintenanceExclusive,
    EmergencyLockout,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ActorClass {
    Operator,
    Automation,
    AI,
    Maintenance,
    Admin,
}
