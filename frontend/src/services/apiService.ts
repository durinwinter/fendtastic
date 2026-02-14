import axios, { AxiosInstance } from 'axios'

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
}

export default new ApiService()
