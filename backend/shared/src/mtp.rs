use serde::{Deserialize, Serialize};

// ─── PEA Information Label ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeaConfig {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub writer: WriterInfo,
    pub services: Vec<ServiceConfig>,
    pub active_elements: Vec<ActiveElement>,
    pub opcua_config: OpcUaConfig,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriterInfo {
    pub name: String,
    pub version: String,
    pub vendor: String,
}

// ─── OPC UA Configuration ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpcUaConfig {
    pub endpoint: String,
    pub namespace_uri: String,
    pub security_policy: String,
}

// ─── Service ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub tag: String,
    pub name: String,
    pub description: String,
    pub config_parameters: Vec<ServiceParameter>,
    pub procedures: Vec<ProcedureConfig>,
}

// ─── Procedure ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcedureConfig {
    pub id: u32,
    pub name: String,
    pub is_self_completing: bool,
    pub is_default: bool,
    pub parameters: Vec<ServiceParameter>,
    pub process_value_outs: Vec<IndicatorElement>,
    pub report_values: Vec<IndicatorElement>,
}

// ─── Parameter Types (MTP Operation Elements) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServiceParameter {
    Analog(AnalogParameter),
    Binary(BinaryParameter),
    DInt(DIntParameter),
    StringParam(StringParameter),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalogParameter {
    pub tag: String,
    pub name: String,
    pub unit: String,
    pub v_scl_min: f64,
    pub v_scl_max: f64,
    pub v_min: f64,
    pub v_max: f64,
    pub v_default: f64,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryParameter {
    pub tag: String,
    pub name: String,
    pub v_state0: String,
    pub v_state1: String,
    pub v_default: bool,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DIntParameter {
    pub tag: String,
    pub name: String,
    pub unit: String,
    pub v_scl_min: i64,
    pub v_scl_max: i64,
    pub v_min: i64,
    pub v_max: i64,
    pub v_default: i64,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringParameter {
    pub tag: String,
    pub name: String,
    pub v_default: String,
    pub tag_mapping: Option<TagMapping>,
}

// ─── Indicator Elements (MTP Views) ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IndicatorElement {
    AnaView(AnaViewConfig),
    BinView(BinViewConfig),
    BinStringView(BinStringViewConfig),
    DIntView(DIntViewConfig),
    DIntStringView(DIntStringViewConfig),
    StringView(StringViewConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnaViewConfig {
    pub tag: String,
    pub name: String,
    pub unit: String,
    pub v_scl_min: f64,
    pub v_scl_max: f64,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinViewConfig {
    pub tag: String,
    pub name: String,
    pub v_state0: String,
    pub v_state1: String,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinStringViewConfig {
    pub tag: String,
    pub name: String,
    pub v_state0: String,
    pub v_state1: String,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DIntViewConfig {
    pub tag: String,
    pub name: String,
    pub unit: String,
    pub v_scl_min: i64,
    pub v_scl_max: i64,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DIntStringViewConfig {
    pub tag: String,
    pub name: String,
    pub v_scl_min: i64,
    pub v_scl_max: i64,
    pub tag_mapping: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringViewConfig {
    pub tag: String,
    pub name: String,
    pub tag_mapping: Option<TagMapping>,
}

// ─── Active Elements ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "element_type")]
pub enum ActiveElement {
    BinVlv(BinVlvConfig),
    BinMon(BinMonConfig),
    AnaVlv(AnaVlvConfig),
    BinDrv(BinDrvConfig),
    AnaDrv(AnaDrvConfig),
    DIntDrv(DIntDrvConfig),
    DIntMon(DIntMonConfig),
    PIDCtrl(PIDCtrlConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinVlvConfig {
    pub tag: String,
    pub name: String,
    pub safe_pos: bool,
    pub open_fbk_tag: Option<TagMapping>,
    pub close_fbk_tag: Option<TagMapping>,
    pub open_cmd_tag: Option<TagMapping>,
    pub close_cmd_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinMonConfig {
    pub tag: String,
    pub name: String,
    pub fbk_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnaVlvConfig {
    pub tag: String,
    pub name: String,
    pub safe_pos: f64,
    pub pos_min: f64,
    pub pos_max: f64,
    pub pos_unit: String,
    pub pos_fbk_tag: Option<TagMapping>,
    pub pos_sp_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinDrvConfig {
    pub tag: String,
    pub name: String,
    pub safe_pos: bool,
    pub fwd_fbk_tag: Option<TagMapping>,
    pub rev_fbk_tag: Option<TagMapping>,
    pub fwd_cmd_tag: Option<TagMapping>,
    pub rev_cmd_tag: Option<TagMapping>,
    pub stop_cmd_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnaDrvConfig {
    pub tag: String,
    pub name: String,
    pub safe_pos: f64,
    pub rpm_min: f64,
    pub rpm_max: f64,
    pub rpm_unit: String,
    pub rpm_fbk_tag: Option<TagMapping>,
    pub rpm_sp_tag: Option<TagMapping>,
    pub fwd_cmd_tag: Option<TagMapping>,
    pub rev_cmd_tag: Option<TagMapping>,
    pub stop_cmd_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DIntDrvConfig {
    pub tag: String,
    pub name: String,
    pub safe_pos: i64,
    pub rpm_min: i64,
    pub rpm_max: i64,
    pub rpm_unit: String,
    pub rpm_fbk_tag: Option<TagMapping>,
    pub rpm_sp_tag: Option<TagMapping>,
    pub fwd_cmd_tag: Option<TagMapping>,
    pub rev_cmd_tag: Option<TagMapping>,
    pub stop_cmd_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DIntMonConfig {
    pub tag: String,
    pub name: String,
    pub unit: String,
    pub v_scl_min: i64,
    pub v_scl_max: i64,
    pub fbk_tag: Option<TagMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PIDCtrlConfig {
    pub tag: String,
    pub name: String,
    pub kp: f64,
    pub ki: f64,
    pub kd: f64,
    pub pv_unit: String,
    pub pv_scl_min: f64,
    pub pv_scl_max: f64,
    pub sp_scl_min: f64,
    pub sp_scl_max: f64,
    pub mv_scl_min: f64,
    pub mv_scl_max: f64,
    pub pv_tag: Option<TagMapping>,
    pub sp_tag: Option<TagMapping>,
    pub mv_tag: Option<TagMapping>,
}

// ─── Tag Mapping ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagMapping {
    pub protocol: ProtocolType,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProtocolType {
    OpcUa,
    Modbus,
    Zenoh,
}

// ─── PackML Service State Machine ────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ServiceState {
    Idle,
    Starting,
    Execute,
    Completing,
    Completed,
    Pausing,
    Paused,
    Resuming,
    Holding,
    Held,
    Unholding,
    Stopping,
    Stopped,
    Aborting,
    Aborted,
    Resetting,
}

impl ServiceState {
    pub fn code(&self) -> u32 {
        match self {
            Self::Idle => 16,
            Self::Starting => 8,
            Self::Execute => 64,
            Self::Completing => 65536,
            Self::Completed => 131072,
            Self::Pausing => 8192,
            Self::Paused => 32,
            Self::Resuming => 16384,
            Self::Holding => 1024,
            Self::Held => 2048,
            Self::Unholding => 4096,
            Self::Stopping => 128,
            Self::Stopped => 4,
            Self::Aborting => 256,
            Self::Aborted => 512,
            Self::Resetting => 32768,
        }
    }

    pub fn from_code(code: u32) -> Option<Self> {
        match code {
            16 => Some(Self::Idle),
            8 => Some(Self::Starting),
            64 => Some(Self::Execute),
            65536 => Some(Self::Completing),
            131072 => Some(Self::Completed),
            8192 => Some(Self::Pausing),
            32 => Some(Self::Paused),
            16384 => Some(Self::Resuming),
            1024 => Some(Self::Holding),
            2048 => Some(Self::Held),
            4096 => Some(Self::Unholding),
            128 => Some(Self::Stopping),
            4 => Some(Self::Stopped),
            256 => Some(Self::Aborting),
            512 => Some(Self::Aborted),
            32768 => Some(Self::Resetting),
            _ => None,
        }
    }

    pub fn is_stable(&self) -> bool {
        matches!(
            self,
            Self::Idle
                | Self::Execute
                | Self::Completed
                | Self::Paused
                | Self::Held
                | Self::Stopped
                | Self::Aborted
        )
    }

    pub fn allowed_commands(&self) -> Vec<ServiceCommand> {
        match self {
            Self::Idle => vec![ServiceCommand::Start, ServiceCommand::Abort],
            Self::Execute => vec![
                ServiceCommand::Complete,
                ServiceCommand::Hold,
                ServiceCommand::Pause,
                ServiceCommand::Stop,
                ServiceCommand::Abort,
            ],
            Self::Completed => vec![
                ServiceCommand::Reset,
                ServiceCommand::Stop,
                ServiceCommand::Abort,
            ],
            Self::Paused => vec![
                ServiceCommand::Resume,
                ServiceCommand::Stop,
                ServiceCommand::Abort,
            ],
            Self::Held => vec![
                ServiceCommand::Unhold,
                ServiceCommand::Stop,
                ServiceCommand::Abort,
            ],
            Self::Stopped => vec![ServiceCommand::Reset, ServiceCommand::Abort],
            Self::Aborted => vec![ServiceCommand::Reset],
            // Transient states: no commands allowed
            _ => vec![],
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ServiceCommand {
    Reset,
    Start,
    Stop,
    Hold,
    Unhold,
    Pause,
    Resume,
    Abort,
    Restart,
    Complete,
}

impl ServiceCommand {
    pub fn code(&self) -> u32 {
        match self {
            Self::Reset => 2,
            Self::Start => 4,
            Self::Stop => 8,
            Self::Hold => 16,
            Self::Unhold => 32,
            Self::Pause => 64,
            Self::Resume => 128,
            Self::Abort => 256,
            Self::Restart => 512,
            Self::Complete => 1024,
        }
    }
}

// ─── Operation / Source Mode ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationMode {
    Offline,
    Operator,
    Automatic,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SourceMode {
    Internal,
    External,
}

// ─── PEA Instance Runtime Status ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeaInstanceStatus {
    pub pea_id: String,
    pub deployed: bool,
    pub running: bool,
    pub services: Vec<ServiceRuntimeState>,
    pub opcua_endpoint: Option<String>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceRuntimeState {
    pub tag: String,
    pub state: ServiceState,
    pub current_procedure_id: Option<u32>,
    pub operation_mode: OperationMode,
    pub source_mode: SourceMode,
}

// ─── EVA-ICS Deployment Structures ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaDeploymentPlan {
    pub pea_id: String,
    pub items: Vec<EvaItem>,
    pub controller_service: Option<EvaControllerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaItem {
    pub oid: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaControllerConfig {
    pub id: String,
    pub opcua_endpoint: String,
    pub node_mappings: Vec<OpcUaNodeMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpcUaNodeMapping {
    pub oid: String,
    pub node_id: String,
    pub interval_ms: u32,
}

// ─── Recipe / Sequence Models ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<RecipeStep>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeStep {
    pub order: u32,
    pub pea_id: String,
    pub service_tag: String,
    pub command: ServiceCommand,
    pub procedure_id: Option<u32>,
    pub parameters: Vec<RecipeParameterValue>,
    pub wait_for_state: Option<ServiceState>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeParameterValue {
    pub parameter_tag: String,
    pub value: serde_json::Value,
}

// ─── Zenoh Topic Helpers ─────────────────────────────────────────────────────

pub mod topics {
    fn get_node_id() -> String {
        std::env::var("MURPH_NODE_ID").unwrap_or_else(|_| "local".to_string())
    }

    pub fn pea_announce(pea_id: &str) -> String {
        format!("murph/habitat/nodes/{}/pea/{}/announce", get_node_id(), pea_id)
    }

    pub fn pea_status(pea_id: &str) -> String {
        format!("murph/habitat/nodes/{}/pea/{}/status", get_node_id(), pea_id)
    }

    pub fn pea_service_state(pea_id: &str, service_tag: &str) -> String {
        format!(
            "murph/habitat/nodes/{}/pea/{}/services/{}/state",
            get_node_id(),
            pea_id,
            service_tag
        )
    }

    pub fn pea_service_command(pea_id: &str, service_tag: &str) -> String {
        format!(
            "murph/habitat/nodes/{}/pea/{}/services/{}/command",
            get_node_id(),
            pea_id,
            service_tag
        )
    }

    pub fn pea_data(pea_id: &str, data_tag: &str) -> String {
        format!(
            "murph/habitat/nodes/{}/pea/{}/data/{}",
            get_node_id(),
            pea_id,
            data_tag
        )
    }

    pub fn pea_config(pea_id: &str) -> String {
        format!("murph/habitat/nodes/{}/pea/{}/config", get_node_id(), pea_id)
    }

    pub fn pea_deploy(pea_id: &str) -> String {
        format!("murph/habitat/nodes/{}/pea/{}/deploy", get_node_id(), pea_id)
    }

    pub fn pea_lifecycle(pea_id: &str) -> String {
        format!("murph/habitat/nodes/{}/pea/{}/lifecycle", get_node_id(), pea_id)
    }

    pub const PEA_ANNOUNCE_WILDCARD: &str = "murph/habitat/nodes/*/pea/*/announce";
    pub const PEA_STATUS_WILDCARD: &str = "murph/habitat/nodes/*/pea/*/status";
    pub const PEA_DEPLOY_WILDCARD: &str = "murph/habitat/nodes/*/pea/*/deploy";
    pub const PEA_LIFECYCLE_WILDCARD: &str = "murph/habitat/nodes/*/pea/*/lifecycle";
    pub const PEA_SERVICE_COMMAND_WILDCARD: &str = "murph/habitat/nodes/*/pea/*/services/*/command";
    pub const POL_RECIPES_COMMAND: &str = "murph/pol/recipes/command";
    pub const POL_RECIPES_STATUS: &str = "murph/pol/recipes/status";
    pub const STATUS_EVA_ICS: &str = "murph/status/eva-ics";
}
