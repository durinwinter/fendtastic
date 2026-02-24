import axios, { AxiosInstance } from 'axios'
import { PeaConfig, ServiceCommand } from '../types/mtp'
import { Recipe } from '../types/recipe'
import { ZenohNode, KeyEntry, NodeConfigRequest, ConfigUpdateRequest } from '../types/mesh'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (!error.response || error.code === 'ERR_NETWORK') {
          window.dispatchEvent(new CustomEvent('api-network-error', {
            detail: { message: `Network Error: ${error.message}. Check if backend is running on port 8080.` }
          }))
        }
        return Promise.reject(error)
      }
    )
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getMetrics() {
    const response = await this.client.get('/metrics')
    return response.data
  }

  async getMachines() {
    const response = await this.client.get('/machines')
    return response.data
  }

  async getMachine(id: string) {
    const response = await this.client.get(`/machines/${id}`)
    return response.data
  }

  async getAlarms() {
    const response = await this.client.get('/alarms')
    return response.data
  }

  async acknowledgeAlarm(id: string) {
    const response = await this.client.post(`/alarms/${id}/ack`)
    return response.data
  }

  async shelveAlarm(id: string) {
    const response = await this.client.post(`/alarms/${id}/shelve`)
    return response.data
  }

  async deleteAlarmById(id: string): Promise<void> {
    await this.client.delete(`/alarms/${id}`)
  }

  async listAlarmRules(): Promise<Array<{
    id: string
    name: string
    severity: string
    source_pattern: string
    event_pattern: string
    enabled: boolean
    created_at: string
    updated_at: string
  }>> {
    const response = await this.client.get('/alarm-rules')
    return response.data
  }

  async createAlarmRule(payload: {
    name: string
    severity: string
    source_pattern: string
    event_pattern: string
    enabled: boolean
  }) {
    const response = await this.client.post('/alarm-rules', payload)
    return response.data
  }

  async updateAlarmRule(id: string, payload: {
    name: string
    severity: string
    source_pattern: string
    event_pattern: string
    enabled: boolean
  }) {
    const response = await this.client.put(`/alarm-rules/${id}`, payload)
    return response.data
  }

  async deleteAlarmRule(id: string): Promise<void> {
    await this.client.delete(`/alarm-rules/${id}`)
  }

  async listBlackouts(): Promise<Array<{
    id: string
    name: string
    starts_at: string
    ends_at: string
    scope: string
    created_at: string
  }>> {
    const response = await this.client.get('/blackouts')
    return response.data
  }

  async createBlackout(payload: {
    name: string
    starts_at: string
    ends_at: string
    scope?: string
  }) {
    const response = await this.client.post('/blackouts', payload)
    return response.data
  }

  async deleteBlackout(id: string): Promise<void> {
    await this.client.delete(`/blackouts/${id}`)
  }

  async getTimeSeries(machineId: string, startTime?: string, endTime?: string) {
    const response = await this.client.get(`/timeseries/${machineId}`, {
      params: { startTime, endTime },
    })
    return response.data
  }

  // ─── PEA CRUD ────────────────────────────────────────────────────────────

  async listPeas(): Promise<PeaConfig[]> {
    const response = await this.client.get('/pea')
    return response.data
  }

  async getPea(id: string): Promise<PeaConfig> {
    const response = await this.client.get(`/pea/${id}`)
    return response.data
  }

  async createPea(config: Partial<PeaConfig>): Promise<PeaConfig> {
    const response = await this.client.post('/pea', config)
    return response.data
  }

  async updatePea(id: string, config: PeaConfig): Promise<PeaConfig> {
    const response = await this.client.put(`/pea/${id}`, config)
    return response.data
  }

  async deletePea(id: string): Promise<void> {
    await this.client.delete(`/pea/${id}`)
  }

  // ─── PEA Lifecycle ───────────────────────────────────────────────────────

  async deployPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/deploy`)
  }

  async undeployPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/undeploy`)
  }

  async startPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/start`)
  }

  async stopPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/stop`)
  }

  async commandService(
    peaId: string,
    serviceTag: string,
    command: ServiceCommand,
    procedureId?: number
  ): Promise<void> {
    await this.client.post(`/pea/${peaId}/services/${serviceTag}/command`, {
      command,
      procedure_id: procedureId ?? null,
    })
  }

  // ─── Recipes ─────────────────────────────────────────────────────────────

  async listRecipes(): Promise<Recipe[]> {
    const response = await this.client.get('/recipes')
    return response.data
  }

  async createRecipe(recipe: Partial<Recipe>): Promise<Recipe> {
    const response = await this.client.post('/recipes', recipe)
    return response.data
  }

  async updateRecipe(id: string, recipe: Recipe): Promise<Recipe> {
    const response = await this.client.put(`/recipes/${id}`, recipe)
    return response.data
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.client.delete(`/recipes/${id}`)
  }

  async executeRecipe(id: string): Promise<void> {
    await this.client.post(`/recipes/${id}/execute`)
  }

  async listRecipeExecutions(): Promise<Array<{
    execution_id: string
    recipe_id: string
    recipe_name: string
    current_step: number
    total_steps: number
    step_statuses: string[]
    state: 'running' | 'completed' | 'failed' | 'aborted' | 'pending'
    started_at: string
    updated_at: string
  }>> {
    const response = await this.client.get('/recipes/executions')
    return response.data
  }

  // ─── Mesh / Zenoh Admin ──────────────────────────────────────────────────

  async getMeshNodes(): Promise<{ local_zid: string; nodes: ZenohNode[]; raw_entries: unknown[] }> {
    const response = await this.client.get('/mesh/nodes')
    return response.data
  }

  async getMeshRouter(): Promise<{ local_zid: string; entries: unknown[] }> {
    const response = await this.client.get('/mesh/router')
    return response.data
  }

  async getMeshLinks(): Promise<unknown[]> {
    const response = await this.client.get('/mesh/links')
    return response.data
  }

  async getMeshKeys(prefix?: string): Promise<KeyEntry[]> {
    const response = await this.client.get('/mesh/keys', {
      params: prefix ? { prefix } : {},
    })
    return response.data
  }

  async getMeshKeyValue(keyExpr: string): Promise<{ key_expr: string; results: unknown[] }> {
    const response = await this.client.get(`/mesh/keys/${keyExpr}`)
    return response.data
  }

  async updateMeshConfig(update: ConfigUpdateRequest): Promise<void> {
    await this.client.post('/mesh/config', update)
  }

  async generateNodeConfig(config: NodeConfigRequest): Promise<object> {
    const response = await this.client.post('/mesh/generate-config', config)
    return response.data
  }

  // ─── Simulator ──────────────────────────────────────────────────────────

  async startSimulator(): Promise<{ status: string; simulator: string; pea_id: string }> {
    const response = await this.client.post('/simulator/start')
    return response.data
  }

  async stopSimulator(): Promise<{ status: string; simulator: string }> {
    const response = await this.client.post('/simulator/stop')
    return response.data
  }

  async getSimulatorStatus(): Promise<{ running: boolean; simulator: string; pea_id: string }> {
    const response = await this.client.get('/simulator/status')
    return response.data
  }

  // ─── Time-Series Historical Data ──────────────────────────────────────────

  async getTsLatest(): Promise<Record<string, { t: number; v: unknown }>> {
    const response = await this.client.get('/ts/latest')
    return response.data
  }

  async getTsKeys(): Promise<{ keys: string[] }> {
    const response = await this.client.get('/ts/keys')
    return response.data
  }

  async queryTimeSeries(key: string, startMs: number, endMs: number): Promise<{
    key: string
    start_ms: number
    end_ms: number
    count: number
    points: Array<{ t: number; v: unknown }>
  }> {
    const response = await this.client.get('/ts/query', {
      params: { key, start_ms: startMs, end_ms: endMs },
    })
    return response.data
  }

  // ─── POL Topology ────────────────────────────────────────────────────────

  async getPolTopology(): Promise<{ edges: Array<{ from: string; to: string }>; updated_at: string }> {
    const response = await this.client.get('/pol/topology')
    return response.data
  }

  async putPolTopology(edges: Array<{ from: string; to: string }>): Promise<{ edges: Array<{ from: string; to: string }>; updated_at: string }> {
    const response = await this.client.put('/pol/topology', { edges })
    return response.data
  }
}

export default new ApiService()
