import axios, { AxiosInstance } from 'axios'
import { PeaConfig } from '../types/mtp'
import { Recipe } from '../types/recipe'
import { ZenohNode, RouterInfo, KeyEntry, NodeConfigRequest, ConfigUpdateRequest } from '../types/mesh'

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

  async startPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/start`)
  }

  async stopPea(id: string): Promise<void> {
    await this.client.post(`/pea/${id}/stop`)
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

  async executeRecipe(id: string): Promise<void> {
    await this.client.post(`/recipes/${id}/execute`)
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
}

export default new ApiService()
