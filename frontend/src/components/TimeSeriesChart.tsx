import React, { useState, useEffect, useCallback } from 'react'
import { Box, ToggleButtonGroup, ToggleButton, Typography, Chip, CircularProgress } from '@mui/material'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js'
import apiService from '../services/apiService'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const TIME_RANGES = [
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
  { label: '15m', ms: 900_000 },
  { label: '1h', ms: 3_600_000 },
  { label: '6h', ms: 21_600_000 },
  { label: '24h', ms: 86_400_000 },
] as const

const COLOR_PALETTE = [
  { border: '#B7410E', bg: 'rgba(183, 65, 14, 0.1)' }, // Mars Rust
  { border: '#FFBF00', bg: 'rgba(255, 191, 0, 0.1)' }, // Terminal Amber
  { border: '#3498DB', bg: 'rgba(52, 152, 219, 0.1)' }, // Ocean Blue
  { border: '#E67E22', bg: 'rgba(230, 126, 34, 0.1)' },
  { border: '#E74C3C', bg: 'rgba(231, 76, 60, 0.1)' },
  { border: '#9B59B6', bg: 'rgba(155, 89, 182, 0.1)' },
  { border: '#1ABC9C', bg: 'rgba(26, 188, 156, 0.1)' },
  { border: '#F1C40F', bg: 'rgba(241, 196, 15, 0.1)' },
  { border: '#00BCD4', bg: 'rgba(0, 188, 212, 0.1)' },
]

/** Extract a short display label from a Zenoh key like "murph/habitat/nodes/node1/pea/reactor1/data/temp" */
function keyToLabel(key: string): string {
  const parts = key.split('/')
  // Show last few parts (e.g. reactor1/temp)
  if (parts.length >= 7) return `${parts[5]}/${parts[7]}`
  return parts.slice(-2).join('/')
}

/** Try to extract a numeric value from a Zenoh payload */
function extractNumeric(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    for (const field of ['value', 'v', 'data', 'val']) {
      if (field in obj) return extractNumeric(obj[field])
    }
  }
  return null
}

const POLL_INTERVAL = 3000

const TimeSeriesChart: React.FC = () => {
  const [rangeMs, setRangeMs] = useState(300_000) // default 5m
  const [keys, setKeys] = useState<string[]>([])
  const [chartData, setChartData] = useState<{
    labels: string[]
    datasets: Array<{
      label: string
      data: (number | null)[]
      borderColor: string
      backgroundColor: string
      fill: boolean
      tension: number
      borderWidth: number
      pointRadius: number
      pointHoverRadius: number
    }>
  }>({ labels: [], datasets: [] })
  const [rawValues, setRawValues] = useState<Record<string, (number | null)[]>>({})
  const [loading, setLoading] = useState(true)

  // Discover available keys on mount
  useEffect(() => {
    apiService.getTsKeys()
      .then(res => setKeys(res.keys || []))
      .catch(() => { })
  }, [])

  const fetchData = useCallback(async () => {
    if (keys.length === 0) {
      setLoading(false)
      return
    }

    const endMs = Date.now()
    const startMs = endMs - rangeMs

    try {
      const results = await Promise.all(
        keys.map(key => apiService.queryTimeSeries(key, startMs, endMs))
      )

      // Collect all unique timestamps across all keys, sorted
      const allTimestamps = new Set<number>()
      const seriesData = results.map(res => {
        const map = new Map<number, number>()
        for (const p of res.points) {
          const y = extractNumeric(p.v)
          if (y !== null) {
            allTimestamps.add(p.t)
            map.set(p.t, y)
          }
        }
        // Compute min/max for normalization
        const vals = Array.from(map.values())
        const min = vals.length > 0 ? Math.min(...vals) : 0
        const max = vals.length > 0 ? Math.max(...vals) : 1
        return { key: res.key, map, min, max }
      })

      const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)
      const labels = sortedTimestamps.map(t => new Date(t).toLocaleTimeString())

      // Build raw values lookup for tooltips
      const rawLookup: Record<string, (number | null)[]> = {}

      const datasets = seriesData
        .map((s, i) => {
          const color = COLOR_PALETTE[i % COLOR_PALETTE.length]
          const rawData = sortedTimestamps.map(t => s.map.get(t) ?? null)
          const hasAny = rawData.some(v => v !== null)
          if (!hasAny) return null

          const label = keyToLabel(s.key)
          rawLookup[label] = rawData

          // Normalize to 0–100 so all sensors share the same scale
          const range = s.max - s.min
          const data = rawData.map(v =>
            v !== null && range > 0 ? ((v - s.min) / range) * 100 : v
          )

          return {
            label,
            data,
            borderColor: color.border,
            backgroundColor: color.bg,
            fill: false,
            spanGaps: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          }
        })
        .filter((ds): ds is NonNullable<typeof ds> => ds !== null)

      setChartData({ labels, datasets })
      setRawValues(rawLookup)
    } catch {
      // keep showing previous data
    } finally {
      setLoading(false)
    }
  }, [keys, rangeMs])

  // Poll for new data
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#ffffff',
          font: { size: 11, weight: 600 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        titleColor: '#6EC72D',
        bodyColor: '#ffffff',
        borderColor: '#6EC72D',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || ''
            const raw = rawValues[label]?.[ctx.dataIndex]
            return raw !== null && raw !== undefined
              ? `${label}: ${raw}`
              : `${label}: --`
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawTicks: false,
        },
        ticks: {
          color: '#b0b0b0',
          font: { size: 10 },
          maxTicksLimit: 10,
        },
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawTicks: false,
        },
        ticks: {
          display: false,
        },
      },
    },
  }

  const hasData = chartData.datasets.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Time range controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <ToggleButtonGroup
          value={rangeMs}
          exclusive
          onChange={(_, val) => { if (val !== null) setRangeMs(val) }}
          size="small"
        >
          {TIME_RANGES.map(r => (
            <ToggleButton
              key={r.label}
              value={r.ms}
              sx={{
                px: 1.5, py: 0.25,
                fontSize: 11,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#6EC72D',
                  backgroundColor: 'rgba(110, 199, 45, 0.15)',
                },
              }}
            >
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Chip
          label={`${keys.length} key${keys.length !== 1 ? 's' : ''}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: 10 }}
        />
      </Box>

      {/* Chart area */}
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress color="primary" size={24} />
          </Box>
        ) : hasData ? (
          <Line data={chartData} options={options} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              No time-series data yet. Data appears as Zenoh values are published to fendtastic/**.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default TimeSeriesChart
