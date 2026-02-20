// Heptapod Mesh — Zenoh network administration types

// ─── Zenoh Node (Session) ────────────────────────────────────────────────────

export interface ZenohNode {
  zid: string
  whatami: 'router' | 'peer' | 'client'
  locators: string[]
  links: ZenohLink[]
}

export interface ZenohLink {
  dst_zid: string
  locators: string[]
  whatami: string
}

// ─── Router Info ─────────────────────────────────────────────────────────────

export interface RouterInfo {
  zid: string
  mode: string
  listen_endpoints: string[]
  connect_endpoints: string[]
  scouting: ScoutingConfig
  plugins: Record<string, unknown>
  raw: Record<string, unknown>
}

export interface ScoutingConfig {
  multicast_enabled: boolean
  multicast_address: string
  multicast_interface: string
}

// ─── Key-Space Entry ─────────────────────────────────────────────────────────

export interface KeyEntry {
  key_expr: string
  value: string | null
  encoding: string
  timestamp: string | null
}

export interface KeyTreeNode {
  segment: string
  full_path: string
  children: KeyTreeNode[]
  has_value: boolean
}

// ─── Node Configuration (for generating configs) ────────────────────────────

export interface NodeConfigRequest {
  mode: 'router' | 'peer' | 'client'
  listen_endpoints: string[]
  connect_endpoints: string[]
  multicast_scouting: boolean
  storage_enabled: boolean
  storage_key_expr: string
}

// ─── Config Update Request ──────────────────────────────────────────────────

export interface ConfigUpdateRequest {
  admin_key: string
  value: unknown
}

// ─── Status helpers ─────────────────────────────────────────────────────────

export type NodeStatus = 'online' | 'degraded' | 'offline'

export function getNodeStatusColor(status: NodeStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'online': return 'success'
    case 'degraded': return 'warning'
    case 'offline': return 'error'
  }
}

export function getRoleColor(whatami: string): 'primary' | 'secondary' | 'info' | 'default' {
  switch (whatami) {
    case 'router': return 'primary'
    case 'peer': return 'secondary'
    case 'client': return 'info'
    default: return 'default'
  }
}

export function truncateZid(zid: string, len = 12): string {
  return zid.length > len ? `${zid.slice(0, len)}...` : zid
}

export function buildKeyTree(entries: KeyEntry[]): KeyTreeNode {
  const root: KeyTreeNode = { segment: '', full_path: '', children: [], has_value: false }

  for (const entry of entries) {
    const segments = entry.key_expr.split('/')
    let current = root

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const fullPath = segments.slice(0, i + 1).join('/')
      let child = current.children.find(c => c.segment === seg)
      if (!child) {
        child = { segment: seg, full_path: fullPath, children: [], has_value: false }
        current.children.push(child)
      }
      if (i === segments.length - 1) {
        child.has_value = true
      }
      current = child
    }
  }

  return root
}
