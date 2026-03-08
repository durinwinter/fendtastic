export interface TimeSeriesPoint {
  t: number
  v: unknown
  min?: number
  max?: number
}

export interface TimeSeriesQueryResponse {
  key: string
  start_ms: number
  end_ms: number
  count: number
  original_count: number
  sampled: boolean
  max_points?: number | null
  points: TimeSeriesPoint[]
}

export interface TimeSeriesConfig {
  max_points_per_key: number
  key_count: number
}
