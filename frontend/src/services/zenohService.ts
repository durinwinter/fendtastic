// Zenoh WebSocket bridge — connects to the API server's /api/v1/ws endpoint
// which relays subscribe/publish/unsubscribe messages to/from the Zenoh bus.

export class ZenohService {
  private ws: WebSocket | null = null
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()
  private connectionListeners: Set<(connected: boolean) => void> = new Set()
  public isConnected: boolean = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pendingSends: any[] = []

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('Zenoh WebSocket connected to', this.url)
          this.isConnected = true
          this.notifyConnectionListeners(true)

          // Re-subscribe to all active subscriptions after reconnect
          for (const key of this.subscribers.keys()) {
            this.send({ type: 'subscribe', key })
          }

          // Flush any messages queued before WS was open
          for (const queued of this.pendingSends) {
            this.send(queued)
          }
          this.pendingSends = []

          resolve()
        }

        this.ws.onerror = (error) => {
          console.error('Zenoh WebSocket error:', error)
          if (!this.isConnected) reject(error)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = () => {
          console.log('Zenoh WebSocket disconnected')
          this.isConnected = false
          this.notifyConnectionListeners(false)
          this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 3000)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback)
    callback(this.isConnected)
    return () => this.connectionListeners.delete(callback)
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected))
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)
      const { key, payload } = message

      if (!key) return

      // Notify exact-match subscribers
      if (this.subscribers.has(key)) {
        this.subscribers.get(key)?.forEach(callback => callback(payload))
      }

      // Notify wildcard/pattern subscribers
      this.subscribers.forEach((callbacks, pattern) => {
        if (pattern !== key && this.matchPattern(key, pattern)) {
          callbacks.forEach(callback => callback({ ...payload, _key: key }))
        }
      })
    } catch (error) {
      console.error('Error handling Zenoh message:', error)
    }
  }

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
      this.send({ type: 'subscribe', key })
    }
    this.subscribers.get(key)!.add(callback)

    return () => {
      this.subscribers.get(key)?.delete(callback)
      if (this.subscribers.get(key)?.size === 0) {
        this.subscribers.delete(key)
        this.send({ type: 'unsubscribe', key })
      }
    }
  }

  publish(key: string, payload: any): void {
    this.send({ type: 'publish', key, payload })
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.pendingSends.push(data)
    }
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\+/g, '[^/]*')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}

// Build the WebSocket URL from the API URL
function buildWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'
  return apiUrl.replace(/^http/, 'ws') + '/ws'
}

const zenohService = new ZenohService(buildWsUrl())

// Auto-connect immediately so subscribers registered before connect() aren't lost
zenohService.connect().catch(() => {})

export default zenohService
