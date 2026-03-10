import React, { useEffect, useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import zenohService from '../services/zenohService'

type SpotValue = {
  key: string
  label: string
  value: string
  unit: string
  updatedAt: number
}

function prettifyTag(tag: string): string {
  return tag
    .split(/[_-]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractValue(payload: unknown): { value: string; unit: string } | null {
  if (payload == null) return null
  if (typeof payload === 'number') return { value: String(Math.round(payload * 100) / 100), unit: '' }
  if (typeof payload === 'string') return { value: payload, unit: '' }
  if (typeof payload === 'boolean') return { value: payload ? 'true' : 'false', unit: '' }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const raw = record.value ?? record.v ?? record.data ?? record.val
    const unit = typeof record.unit === 'string'
      ? record.unit
      : typeof record.units === 'string'
        ? record.units
        : ''
    if (typeof raw === 'number') return { value: String(Math.round(raw * 100) / 100), unit }
    if (typeof raw === 'string') return { value: raw, unit }
    if (typeof raw === 'boolean') return { value: raw ? 'true' : 'false', unit }
  }
  return null
}

function extractMetric(key: string, payload: unknown): SpotValue | null {
  const parts = key.split('/')
  const dataIndex = parts.indexOf('data')
  if (dataIndex < 0 || dataIndex >= parts.length - 1) return null

  const value = extractValue(payload)
  if (!value) return null

  const peaIndex = parts.indexOf('pea')
  const peaId = peaIndex >= 0 && peaIndex < parts.length - 1 ? parts[peaIndex + 1] : 'pea'
  const tag = parts[dataIndex + 1]

  return {
    key,
    label: `${prettifyTag(tag)} (${peaId})`,
    value: value.value,
    unit: value.unit,
    updatedAt: Date.now(),
  }
}

const EMPTY_MESSAGE = 'Waiting for entmoot telemetry'

const SpotValues: React.FC = () => {
  const [metrics, setMetrics] = useState<Record<string, SpotValue>>({})
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const unsubscribe = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/data/+', (payload) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      if (!key) return
      const metric = extractMetric(key, payload)
      if (!metric) return
      setMetrics((current) => ({
        ...current,
        [metric.key]: metric,
      }))
    })

    const timer = setInterval(() => setNowMs(Date.now()), 5000)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [])

  const spotValues = useMemo(() => {
    return Object.values(metrics)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
  }, [metrics])

  if (spotValues.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {EMPTY_MESSAGE}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {spotValues.map((item) => {
        const ageMs = nowMs - item.updatedAt
        const freshnessColor = ageMs < 10_000 ? '#6EC72D' : ageMs < 30_000 ? '#F0B45A' : '#A1553A'
        return (
          <Box key={item.key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.02em' }}>
              {item.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>
                {item.value}
              </Typography>
              {item.unit && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                  {item.unit}
                </Typography>
              )}
            </Box>
            <Box sx={{ height: 2, width: '100%', backgroundColor: '#222', mt: 0.5 }}>
              <Box sx={{ height: '100%', width: '100%', backgroundColor: freshnessColor, transition: 'background-color 0.3s ease-in-out' }} />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export default SpotValues
