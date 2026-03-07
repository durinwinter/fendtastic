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
