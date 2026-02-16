// EVA-ICS v4 deployment types
// Used when deploying PEA configurations to EVA-ICS

export interface EvaDeploymentPlan {
  pea_id: string
  items: EvaItem[]
  controller_service: EvaControllerConfig | null
}

export interface EvaItem {
  oid: string
  enabled: boolean
}

export interface EvaControllerConfig {
  id: string
  opcua_endpoint: string
  node_mappings: OpcUaNodeMapping[]
}

export interface OpcUaNodeMapping {
  oid: string
  node_id: string
  interval_ms: number
}
