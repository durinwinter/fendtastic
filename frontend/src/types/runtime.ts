export interface RuntimeNode {
  id: string
  name: string
  architecture: 'Arm64' | 'ArmV7' | 'Amd64'
  host: string
  neuron: NeuronConnection
  assigned_pea_id?: string | null
  status: 'Unknown' | 'Offline' | 'Online' | 'Degraded'
  created_at: string
  updated_at: string
}

export interface NeuronConnection {
  base_url: string
  username?: string | null
  password_ref?: string | null
  config_path?: string | null
  mode: 'Api' | 'FileExport' | 'Hybrid'
}

export interface RuntimeNodeHealthCheck {
  name: string
  ok: boolean
  message: string
}

export interface RuntimeNodeStatusSnapshot {
  runtime_node_id: string
  status: RuntimeNode['status']
  checks: RuntimeNodeHealthCheck[]
  updated_at: string
}
