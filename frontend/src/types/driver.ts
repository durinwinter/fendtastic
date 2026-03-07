export interface DriverCatalogEntry {
  key: string
  name: string
  vendor: string
  direction: 'Southbound' | 'Northbound'
  config_schema: Record<string, unknown>
  tag_schema: Record<string, unknown>
}

export interface DriverInstance {
  id: string
  runtime_node_id: string
  pea_id: string
  driver_key: string
  display_name: string
  state: 'Created' | 'Configured' | 'Running' | 'Stopped' | 'Error'
  config: Record<string, unknown>
  tag_groups: TagGroup[]
  last_error?: string | null
  created_at: string
  updated_at: string
}

export interface DriverSchemaPayload extends DriverCatalogEntry {
  source?: 'neuron' | 'builtin'
}

export interface DriverOperationRecord {
  tag_id: string
  tag_name: string
  value: unknown
  ok: boolean
  message?: string | null
  timestamp: string
}

export interface DriverStatusSnapshot {
  driver_id: string
  node_name: string
  state: DriverInstance['state']
  remote_running?: boolean | null
  remote_link?: number | null
  remote_rtt?: number | null
  last_error?: string | null
  last_read?: DriverOperationRecord | null
  last_write?: DriverOperationRecord | null
  updated_at: string
}

export interface TagGroup {
  id: string
  name: string
  description?: string | null
  tags: DriverTag[]
}

export interface DriverTag {
  id: string
  name: string
  address: string
  data_type: 'Bool' | 'Int16' | 'Uint16' | 'Int32' | 'Uint32' | 'Float32' | 'Float64' | 'String'
  access: 'Read' | 'Write' | 'ReadWrite'
  scan_ms?: number | null
  attributes: Record<string, unknown>
}
