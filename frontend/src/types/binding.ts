export interface PeaBinding {
  id: string
  pea_id: string
  runtime_node_id: string
  driver_instance_id: string
  mappings: TagBinding[]
  validation: BindingValidationSummary
}

export interface TagBinding {
  canonical_tag: string
  driver_tag_id: string
  direction: 'ReadFromDriver' | 'WriteToDriver' | 'Bidirectional'
  transform?: Record<string, unknown> | null
}

export interface BindingValidationSummary {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface BindingReadResponse {
  binding_id: string
  canonical_tag: string
  driver_instance_id: string
  driver_tag_id: string
  result: {
    tag_id: string
    tag_name: string
    value: unknown
    error?: number | null
    quality: string
    timestamp: string
  }
}

export interface BindingWriteResponse {
  binding_id: string
  canonical_tag: string
  driver_instance_id: string
  driver_tag_id: string
  actor_id: string
  status: string
  timestamp: string
}
