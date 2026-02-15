// Zenoh WebSocket service for real-time data streaming
// Note: This is a placeholder for Zenoh WebSocket integration
// The actual Zenoh WebSocket client would need to be implemented based on your specific setup

export class ZenohService {
  private ws: WebSocket | null = null
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()
  private connectionListeners: Set<(connected: boolean) => void> = new Set()
  public isConnected: boolean = false

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('Zenoh WebSocket connected')
          this.isConnected = true
          this.notifyConnectionListeners(true)
          resolve()
        }

        this.ws.onerror = (error) => {
          console.error('Zenoh WebSocket error:', error)
          // Don't reject here if we want auto-reconnect logic to persist?
          // For now, simple reject is fine for initial connection.
          if (!this.isConnected) reject(error)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = () => {
          console.log('Zenoh WebSocket disconnected')
          this.isConnected = false
          this.notifyConnectionListeners(false)
          setTimeout(() => this.connect(), 5000) // Auto-reconnect
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback)
    // Notify immediately of current state
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

      // Notify subscribers
      if (this.subscribers.has(key)) {
        this.subscribers.get(key)?.forEach(callback => callback(payload))
      }

      // Notify wildcard subscribers
      this.subscribers.forEach((callbacks, pattern) => {
        if (this.matchPattern(key, pattern)) {
          callbacks.forEach(callback => callback(payload))
        }
      })
    } catch (error) {
      console.error('Error handling message:', error)
    }
  }

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    this.subscribers.get(key)!.add(callback)

    // Send subscription request to Zenoh
    this.send({
      type: 'subscribe',
      key,
    })

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback)
      if (this.subscribers.get(key)?.size === 0) {
        this.subscribers.delete(key)
        this.send({
          type: 'unsubscribe',
          key,
        })
      }
    }
  }

  publish(key: string, payload: any): void {
    this.send({
      type: 'publish',
      key,
      payload,
    })
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private matchPattern(key: string, pattern: string): boolean {
    // Simple pattern matching for wildcards
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }

  disconnect(): void {
    this.ws?.close()
  }
}

// Singleton instance
const zenohService = new ZenohService(
  import.meta.env.VITE_ZENOH_WS || 'ws://localhost:8000'
)

export default zenohService
