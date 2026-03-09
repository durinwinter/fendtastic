import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { PeaBinding } from '../../types/binding'
import { TimeSeriesConfig, TimeSeriesPoint, TimeSeriesQueryResponse } from '../../types/timeseries'
import apiService from '../../services/apiService'

interface BindingHistoryPanelProps {
  binding: PeaBinding | null
  bindingValues: Record<string, unknown>
}

const RANGE_OPTIONS = [
  { key: '5m', label: '5m', durationMs: 5 * 60 * 1000 },
  { key: '1h', label: '1h', durationMs: 60 * 60 * 1000 },
  { key: '6h', label: '6h', durationMs: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24h', durationMs: 24 * 60 * 60 * 1000 },
] as const

function bindingValueKey(binding: PeaBinding, canonicalTag: string): string {
  return `murph/runtime/nodes/${binding.runtime_node_id}/pea/${binding.pea_id}/bindings/${canonicalTag}/value`
}

function safeFileStem(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-')
}

function toDisplayValue(value: unknown): string {
  if (typeof value === 'undefined') return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function extractNumericValue(point: TimeSeriesPoint): number | null {
  if (typeof point.v === 'number') return point.v
  if (point.v && typeof point.v === 'object') {
    const resultValue = (point.v as { result?: { value?: unknown } }).result?.value
    if (typeof resultValue === 'number') return resultValue
  }
  return null
}

function buildSparkline(points: TimeSeriesPoint[]): string | null {
  const numericPoints = points
    .map((point) => ({ x: point.t, y: extractNumericValue(point) }))
    .filter((point): point is { x: number; y: number } => point.y !== null)

  if (numericPoints.length < 2) return null

  const minX = numericPoints[0].x
  const maxX = numericPoints[numericPoints.length - 1].x
  const minY = Math.min(...numericPoints.map((point) => point.y))
  const maxY = Math.max(...numericPoints.map((point) => point.y))

  return numericPoints
    .map((point) => {
      const x = maxX === minX ? 0 : ((point.x - minX) / (maxX - minX)) * 100
      const y = maxY === minY ? 50 : 100 - ((point.y - minY) / (maxY - minY)) * 100
      return `${x},${y}`
    })
    .join(' ')
}

export default function BindingHistoryPanel({
  binding,
  bindingValues,
}: BindingHistoryPanelProps) {
  const readableMappings = useMemo(
    () =>
      (binding?.mappings ?? []).filter(
        (mapping) => mapping.direction === 'ReadFromDriver' || mapping.direction === 'Bidirectional'
      ),
    [binding]
  )
  const [selectedCanonicalTag, setSelectedCanonicalTag] = useState<string>('')
  const [rangeKey, setRangeKey] = useState<(typeof RANGE_OPTIONS)[number]['key']>('1h')
  const [history, setHistory] = useState<TimeSeriesQueryResponse | null>(null)
  const [tsConfig, setTsConfig] = useState<TimeSeriesConfig | null>(null)
  const [retentionDraft, setRetentionDraft] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [configMessage, setConfigMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const nextTag = readableMappings[0]?.canonical_tag ?? ''
    setSelectedCanonicalTag((current) =>
      current && readableMappings.some((mapping) => mapping.canonical_tag === current) ? current : nextTag
    )
  }, [readableMappings])

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      try {
        const config = await apiService.getTsConfig()
        if (cancelled) return
        setTsConfig(config)
        setRetentionDraft(String(config.max_points_per_key))
      } catch {
        if (!cancelled) {
          setConfigMessage({ severity: 'error', text: 'Failed to load time-series retention config.' })
        }
      }
    }
    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!binding || !selectedCanonicalTag) {
      setHistory(null)
      return
    }

    let cancelled = false
    const range = RANGE_OPTIONS.find((option) => option.key === rangeKey) ?? RANGE_OPTIONS[1]
    const endMs = Date.now()
    const startMs = endMs - range.durationMs
    const key = bindingValueKey(binding, selectedCanonicalTag)

    const loadHistory = async () => {
      setIsLoading(true)
      try {
        const response = await apiService.queryTimeSeries(key, startMs, endMs, 120)
        if (!cancelled) setHistory(response)
      } catch {
        if (!cancelled) {
          setHistory(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [binding?.id, selectedCanonicalTag, rangeKey])

  useEffect(() => {
    if (!selectedCanonicalTag) return
    const liveValue = bindingValues[selectedCanonicalTag]
    if (typeof liveValue === 'undefined') return

    setHistory((current) => {
      if (!current) return current
      const nextPoint: TimeSeriesPoint = { t: Date.now(), v: liveValue }
      const lastPoint = current.points[current.points.length - 1]
      if (lastPoint && JSON.stringify(lastPoint.v) === JSON.stringify(nextPoint.v)) {
        return current
      }
      const nextPoints = [...current.points, nextPoint].slice(-120)
      return {
        ...current,
        count: nextPoints.length,
        original_count: Math.max(current.original_count, nextPoints.length),
        points: nextPoints,
      }
    })
  }, [bindingValues, selectedCanonicalTag])

  const latestValue = selectedCanonicalTag ? bindingValues[selectedCanonicalTag] : undefined
  const sparkline = useMemo(() => buildSparkline(history?.points ?? []), [history?.points])
  const recentPoints = useMemo(() => (history?.points ?? []).slice(-8).reverse(), [history?.points])
  const canSaveRetention =
    retentionDraft.trim() !== '' &&
    Number.isInteger(Number(retentionDraft)) &&
    Number(retentionDraft) >= 32 &&
    Number(retentionDraft) !== tsConfig?.max_points_per_key

  const handleSaveRetention = async () => {
    try {
      const updated = await apiService.updateTsConfig(Number(retentionDraft))
      setTsConfig(updated)
      setRetentionDraft(String(updated.max_points_per_key))
      setConfigMessage({ severity: 'success', text: 'Time-series retention updated.' })
    } catch (error) {
      setConfigMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Failed to update retention.',
      })
    }
  }

  const downloadHistory = (format: 'json' | 'csv') => {
    if (!binding || !selectedCanonicalTag || !history) return

    const filenameBase = safeFileStem(`${binding.pea_id}-${selectedCanonicalTag}-${rangeKey}`)
    const payload =
      format === 'json'
        ? JSON.stringify(history, null, 2)
        : [
            'timestamp_iso,timestamp_ms,value,min,max',
            ...history.points.map((point) => {
              const value = toDisplayValue(point.v).replace(/"/g, '""')
              return `"${new Date(point.t).toISOString()}",${point.t},"${value}",${point.min ?? ''},${point.max ?? ''}`
            }),
          ].join('\n')

    const blob = new Blob([payload], {
      type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filenameBase}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Binding History
      </Typography>

      {!binding ? (
        <Alert severity="info">Create a binding to inspect canonical-tag history.</Alert>
      ) : readableMappings.length === 0 ? (
        <Alert severity="info">Add at least one readable canonical tag to see live history.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${readableMappings.length} readable mappings`} variant="outlined" color="primary" />
            <Chip
              label={
                latestValue === undefined
                  ? 'Current value pending'
                  : `Current value ${toDisplayValue(latestValue)}`
              }
              variant="outlined"
              color={latestValue === undefined ? 'default' : 'success'}
            />
            {history?.sampled && <Chip label={`Downsampled to ${history.count} points`} color="warning" variant="outlined" />}
          </Box>

          <TextField
            select
            size="small"
            label="Canonical Tag"
            value={selectedCanonicalTag}
            onChange={(event) => setSelectedCanonicalTag(event.target.value)}
          >
            {readableMappings.map((mapping) => (
              <MenuItem key={mapping.canonical_tag} value={mapping.canonical_tag}>
                {mapping.canonical_tag}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.key}
                size="small"
                variant={rangeKey === option.key ? 'contained' : 'outlined'}
                onClick={() => setRangeKey(option.key)}
              >
                {option.label}
              </Button>
            ))}
            <Button size="small" variant="outlined" onClick={() => downloadHistory('json')} disabled={!history || history.points.length === 0}>
              Export JSON
            </Button>
            <Button size="small" variant="outlined" onClick={() => downloadHistory('csv')} disabled={!history || history.points.length === 0}>
              Export CSV
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.02)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Trend
            </Typography>
            {isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading history...
              </Typography>
            ) : !history || history.points.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No points in the selected range yet.
              </Typography>
            ) : sparkline ? (
              <Box>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 180 }}>
                  <polyline
                    fill="none"
                    stroke="#f2a65a"
                    strokeWidth="2"
                    points={sparkline}
                  />
                </svg>
                <Typography variant="caption" color="text.secondary">
                  {history.original_count} raw points, {history.count} returned
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                {recentPoints.map((point) => (
                  <ListItem key={`${point.t}-${toDisplayValue(point.v)}`} disableGutters>
                    <ListItemText
                      primary={toDisplayValue(point.v)}
                      secondary={new Date(point.t).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Retention
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                label="Max Points Per Key"
                value={retentionDraft}
                onChange={(event) => setRetentionDraft(event.target.value)}
                helperText="Applies to all keys in the in-memory ring buffer."
              />
              <Button variant="outlined" onClick={() => void handleSaveRetention()} disabled={!canSaveRetention}>
                Save Retention
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Current retention: {tsConfig?.max_points_per_key ?? 'loading'} points per key across {tsConfig?.key_count ?? 0} keys.
            </Typography>
            {configMessage && <Alert severity={configMessage.severity} sx={{ mt: 1 }}>{configMessage.text}</Alert>}
          </Paper>
        </Box>
      )}
    </Paper>
  )
}
