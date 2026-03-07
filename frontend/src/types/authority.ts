export interface AuthorityState {
  pea_id: string
  mode:
    | 'ObserveOnly'
    | 'OperatorExclusive'
    | 'AutoExclusive'
    | 'AIAssisted'
    | 'AIExclusive'
    | 'MaintenanceExclusive'
    | 'EmergencyLockout'
  owner_actor_id?: string | null
  owner_actor_class?: 'Operator' | 'Automation' | 'AI' | 'Maintenance' | 'Admin' | null
  updated_at: string
  reason?: string | null
}

export interface AuthorityAuditRecord {
  pea_id: string
  mode: AuthorityState['mode']
  owner_actor_id?: string | null
  owner_actor_class?: AuthorityState['owner_actor_class']
  changed_at: string
  reason?: string | null
}
