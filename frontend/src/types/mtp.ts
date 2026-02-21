// MTP (Module Type Package) type definitions
// Mirrors backend/shared/src/mtp.rs — keep in sync

// ─── PEA Configuration ──────────────────────────────────────────────────────

export interface PeaConfig {
  id: string
  name: string
  version: string
  description: string
  writer: WriterInfo
  services: ServiceConfig[]
  active_elements: ActiveElement[]
  opcua_config: OpcUaConfig
  created_at: string
  updated_at: string
}

export interface WriterInfo {
  name: string
  version: string
  vendor: string
}

export interface OpcUaConfig {
  endpoint: string
  namespace_uri: string
  security_policy: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

export interface ServiceConfig {
  tag: string
  name: string
  description: string
  config_parameters: ServiceParameter[]
  procedures: ProcedureConfig[]
}

// ─── Procedure ───────────────────────────────────────────────────────────────

export interface ProcedureConfig {
  id: number
  name: string
  is_self_completing: boolean
  is_default: boolean
  parameters: ServiceParameter[]
  process_value_outs: IndicatorElement[]
  report_values: IndicatorElement[]
}

// ─── Parameter Types (MTP Operation Elements) ────────────────────────────────

export type ServiceParameter =
  | ({ type: 'Analog' } & AnalogParameter)
  | ({ type: 'Binary' } & BinaryParameter)
  | ({ type: 'DInt' } & DIntParameter)
  | ({ type: 'StringParam' } & StringParameter)

export interface AnalogParameter {
  tag: string
  name: string
  unit: string
  v_scl_min: number
  v_scl_max: number
  v_min: number
  v_max: number
  v_default: number
  tag_mapping: TagMapping | null
}

export interface BinaryParameter {
  tag: string
  name: string
  v_state0: string
  v_state1: string
  v_default: boolean
  tag_mapping: TagMapping | null
}

export interface DIntParameter {
  tag: string
  name: string
  unit: string
  v_scl_min: number
  v_scl_max: number
  v_min: number
  v_max: number
  v_default: number
  tag_mapping: TagMapping | null
}

export interface StringParameter {
  tag: string
  name: string
  v_default: string
  tag_mapping: TagMapping | null
}

// ─── Indicator Elements (MTP Views) ──────────────────────────────────────────

export type IndicatorElement =
  | ({ type: 'AnaView' } & AnaViewConfig)
  | ({ type: 'BinView' } & BinViewConfig)
  | ({ type: 'BinStringView' } & BinStringViewConfig)
  | ({ type: 'DIntView' } & DIntViewConfig)
  | ({ type: 'DIntStringView' } & DIntStringViewConfig)
  | ({ type: 'StringView' } & StringViewConfig)

export interface AnaViewConfig {
  tag: string
  name: string
  unit: string
  v_scl_min: number
  v_scl_max: number
  tag_mapping: TagMapping | null
}

export interface BinViewConfig {
  tag: string
  name: string
  v_state0: string
  v_state1: string
  tag_mapping: TagMapping | null
}

export interface BinStringViewConfig {
  tag: string
  name: string
  v_state0: string
  v_state1: string
  tag_mapping: TagMapping | null
}

export interface DIntViewConfig {
  tag: string
  name: string
  unit: string
  v_scl_min: number
  v_scl_max: number
  tag_mapping: TagMapping | null
}

export interface DIntStringViewConfig {
  tag: string
  name: string
  v_scl_min: number
  v_scl_max: number
  tag_mapping: TagMapping | null
}

export interface StringViewConfig {
  tag: string
  name: string
  tag_mapping: TagMapping | null
}

// ─── Active Elements ─────────────────────────────────────────────────────────

export type ActiveElement =
  | ({ element_type: 'BinVlv' } & BinVlvConfig)
  | ({ element_type: 'BinMon' } & BinMonConfig)
  | ({ element_type: 'AnaVlv' } & AnaVlvConfig)
  | ({ element_type: 'BinDrv' } & BinDrvConfig)
  | ({ element_type: 'AnaDrv' } & AnaDrvConfig)
  | ({ element_type: 'DIntDrv' } & DIntDrvConfig)
  | ({ element_type: 'DIntMon' } & DIntMonConfig)
  | ({ element_type: 'PIDCtrl' } & PIDCtrlConfig)

export interface BinVlvConfig {
  tag: string
  name: string
  safe_pos: boolean
  open_fbk_tag: TagMapping | null
  close_fbk_tag: TagMapping | null
  open_cmd_tag: TagMapping | null
  close_cmd_tag: TagMapping | null
}

export interface BinMonConfig {
  tag: string
  name: string
  fbk_tag: TagMapping | null
}

export interface AnaVlvConfig {
  tag: string
  name: string
  safe_pos: number
  pos_min: number
  pos_max: number
  pos_unit: string
  pos_fbk_tag: TagMapping | null
  pos_sp_tag: TagMapping | null
}

export interface BinDrvConfig {
  tag: string
  name: string
  safe_pos: boolean
  fwd_fbk_tag: TagMapping | null
  rev_fbk_tag: TagMapping | null
  fwd_cmd_tag: TagMapping | null
  rev_cmd_tag: TagMapping | null
  stop_cmd_tag: TagMapping | null
}

export interface AnaDrvConfig {
  tag: string
  name: string
  safe_pos: number
  rpm_min: number
  rpm_max: number
  rpm_unit: string
  rpm_fbk_tag: TagMapping | null
  rpm_sp_tag: TagMapping | null
  fwd_cmd_tag: TagMapping | null
  rev_cmd_tag: TagMapping | null
  stop_cmd_tag: TagMapping | null
}

export interface DIntDrvConfig {
  tag: string
  name: string
  safe_pos: number
  rpm_min: number
  rpm_max: number
  rpm_unit: string
  rpm_fbk_tag: TagMapping | null
  rpm_sp_tag: TagMapping | null
  fwd_cmd_tag: TagMapping | null
  rev_cmd_tag: TagMapping | null
  stop_cmd_tag: TagMapping | null
}

export interface DIntMonConfig {
  tag: string
  name: string
  unit: string
  v_scl_min: number
  v_scl_max: number
  fbk_tag: TagMapping | null
}

export interface PIDCtrlConfig {
  tag: string
  name: string
  kp: number
  ki: number
  kd: number
  pv_unit: string
  pv_scl_min: number
  pv_scl_max: number
  sp_scl_min: number
  sp_scl_max: number
  mv_scl_min: number
  mv_scl_max: number
  pv_tag: TagMapping | null
  sp_tag: TagMapping | null
  mv_tag: TagMapping | null
}

// ─── Tag Mapping ─────────────────────────────────────────────────────────────

export interface TagMapping {
  protocol: ProtocolType
  address: string
}

export type ProtocolType = 'OpcUa' | 'Modbus' | 'Zenoh'

// ─── PackML Service State Machine ────────────────────────────────────────────

export enum ServiceState {
  Idle = 'Idle',
  Starting = 'Starting',
  Execute = 'Execute',
  Completing = 'Completing',
  Completed = 'Completed',
  Pausing = 'Pausing',
  Paused = 'Paused',
  Resuming = 'Resuming',
  Holding = 'Holding',
  Held = 'Held',
  Unholding = 'Unholding',
  Stopping = 'Stopping',
  Stopped = 'Stopped',
  Aborting = 'Aborting',
  Aborted = 'Aborted',
  Resetting = 'Resetting',
}

export const SERVICE_STATE_CODES: Record<ServiceState, number> = {
  [ServiceState.Idle]: 16,
  [ServiceState.Starting]: 8,
  [ServiceState.Execute]: 64,
  [ServiceState.Completing]: 65536,
  [ServiceState.Completed]: 131072,
  [ServiceState.Pausing]: 8192,
  [ServiceState.Paused]: 32,
  [ServiceState.Resuming]: 16384,
  [ServiceState.Holding]: 1024,
  [ServiceState.Held]: 2048,
  [ServiceState.Unholding]: 4096,
  [ServiceState.Stopping]: 128,
  [ServiceState.Stopped]: 4,
  [ServiceState.Aborting]: 256,
  [ServiceState.Aborted]: 512,
  [ServiceState.Resetting]: 32768,
}

export enum ServiceCommand {
  Reset = 'Reset',
  Start = 'Start',
  Stop = 'Stop',
  Hold = 'Hold',
  Unhold = 'Unhold',
  Pause = 'Pause',
  Resume = 'Resume',
  Abort = 'Abort',
  Restart = 'Restart',
  Complete = 'Complete',
}

export const ALLOWED_COMMANDS: Record<ServiceState, ServiceCommand[]> = {
  [ServiceState.Idle]: [ServiceCommand.Start, ServiceCommand.Abort],
  [ServiceState.Execute]: [
    ServiceCommand.Complete, ServiceCommand.Hold,
    ServiceCommand.Pause, ServiceCommand.Stop, ServiceCommand.Abort,
  ],
  [ServiceState.Completed]: [ServiceCommand.Reset, ServiceCommand.Stop, ServiceCommand.Abort],
  [ServiceState.Paused]: [ServiceCommand.Resume, ServiceCommand.Stop, ServiceCommand.Abort],
  [ServiceState.Held]: [ServiceCommand.Unhold, ServiceCommand.Stop, ServiceCommand.Abort],
  [ServiceState.Stopped]: [ServiceCommand.Reset, ServiceCommand.Abort],
  [ServiceState.Aborted]: [ServiceCommand.Reset],
  // Transient states: no commands
  [ServiceState.Starting]: [],
  [ServiceState.Completing]: [],
  [ServiceState.Pausing]: [],
  [ServiceState.Resuming]: [],
  [ServiceState.Holding]: [],
  [ServiceState.Unholding]: [],
  [ServiceState.Stopping]: [],
  [ServiceState.Aborting]: [],
  [ServiceState.Resetting]: [],
}

export type OperationMode = 'Offline' | 'Operator' | 'Automatic'
export type SourceMode = 'Internal' | 'External'

// ─── PEA Instance Runtime Status ─────────────────────────────────────────────

export interface PeaInstanceStatus {
  pea_id: string
  deployed: boolean
  running: boolean
  services: ServiceRuntimeState[]
  opcua_endpoint: string | null
  last_updated: string
}

export interface ServiceRuntimeState {
  tag: string
  state: ServiceState
  current_procedure_id: number | null
  operation_mode: OperationMode
  source_mode: SourceMode
}

// ─── State Color Helpers ─────────────────────────────────────────────────────

export function getStateColor(state: ServiceState): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (state) {
    case ServiceState.Execute:
    case ServiceState.Completed:
      return 'success'
    case ServiceState.Idle:
    case ServiceState.Held:
    case ServiceState.Paused:
      return 'warning'
    case ServiceState.Aborted:
    case ServiceState.Stopped:
    case ServiceState.Aborting:
    case ServiceState.Stopping:
      return 'error'
    case ServiceState.Starting:
    case ServiceState.Resuming:
    case ServiceState.Unholding:
    case ServiceState.Resetting:
      return 'info'
    default:
      return 'default'
  }
}

// ─── Zenoh Topic Helpers ─────────────────────────────────────────────────────

export const ZENOH_TOPICS = {
  peaAnnounce: (peaId: string) => `fendtastic/pea/${peaId}/announce`,
  peaStatus: (peaId: string) => `fendtastic/pea/${peaId}/status`,
  peaServiceState: (peaId: string, svcTag: string) =>
    `fendtastic/pea/${peaId}/services/${svcTag}/state`,
  peaServiceCommand: (peaId: string, svcTag: string) =>
    `fendtastic/pea/${peaId}/services/${svcTag}/command`,
  peaData: (peaId: string, dataTag: string) =>
    `fendtastic/pea/${peaId}/data/${dataTag}`,
  peaConfig: (peaId: string) => `fendtastic/pea/${peaId}/config`,

  peaDiscoveryWildcard: 'fendtastic/pea/+/announce',
  peaStatusWildcard: 'fendtastic/pea/+/status',
  polRecipesCommand: 'fendtastic/pol/recipes/command',
  polRecipesStatus: 'fendtastic/pol/recipes/status',
  statusEvaIcs: 'fendtastic/status/eva-ics',
} as const

// ─── Factory Helpers ─────────────────────────────────────────────────────────

export function createEmptyPeaConfig(): PeaConfig {
  const now = new Date().toISOString()
  return {
    id: '',
    name: '',
    version: '1.0.0',
    description: '',
    writer: { name: '', version: '1.0.0', vendor: '' },
    services: [],
    active_elements: [],
    opcua_config: {
      endpoint: 'opc.tcp://0.0.0.0:4840',
      namespace_uri: '',
      security_policy: 'None',
    },
    created_at: now,
    updated_at: now,
  }
}

export function createEmptyService(): ServiceConfig {
  return {
    tag: '',
    name: '',
    description: '',
    config_parameters: [],
    procedures: [{
      id: 1,
      name: 'Default',
      is_self_completing: false,
      is_default: true,
      parameters: [],
      process_value_outs: [],
      report_values: [],
    }],
  }
}

export function createEmptyProcedure(id: number): ProcedureConfig {
  return {
    id,
    name: '',
    is_self_completing: false,
    is_default: false,
    parameters: [],
    process_value_outs: [],
    report_values: [],
  }
}
