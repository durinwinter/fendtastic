import React, { useState, useEffect, useRef } from 'react'
import { Box, Paper, Typography, Divider } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'
import apiService from '../services/apiService'

interface SpotValue {
  label: string
  value: string | number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
}

const LABEL_MAP: Record<string, { label: string; unit: string }> = {
  engine_temp: { label: 'Engine Temp', unit: '°C' },
  oil_pressure: { label: 'Oil Pressure', unit: 'PSI' },
  rpm: { label: 'RPM', unit: 'rpm' },
  fuel_level: { label: 'Fuel Level', unit: '%' },
  hydraulic_temp: { label: 'Hydraulic Temp', unit: '°C' },
  battery_voltage: { label: 'Battery Voltage', unit: 'V' },
  coolant_level: { label: 'Coolant Level', unit: '%' },
  vibration: { label: 'Vibration', unit: 'Hz' },
}

const DEFAULT_VALUES: SpotValue[] = Object.values(LABEL_MAP).map(({ label, unit }) => ({
  label,
  value: '--',
  unit,
  status: 'normal' as const,
  trend: 'stable' as const,
}))

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

const POLL_INTERVAL = 1000

const SpotValues: React.FC = () => {
  const [spotValues, setSpotValues] = useState<SpotValue[]>(DEFAULT_VALUES)
  const [connected, setConnected] = useState(false)
  const prevValuesRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let active = true

    const poll = async () => {
      try {
        const latest = await apiService.getTsLatest()
        if (!active) return

        setConnected(true)

        // Build a map from sensor tag to latest numeric value
        const updates: Record<string, number> = {}
        for (const [key, entry] of Object.entries(latest)) {
          // Extract tag from key like "fendtastic/pea/fendt-vario-1001/data/engine_temp"
          const tag = key.split('/').pop() || ''
          if (tag in LABEL_MAP) {
            const num = extractNumeric(entry.v)
            if (num !== null) {
              updates[tag] = Math.round(num * 10) / 10
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          const prev = prevValuesRef.current

          setSpotValues(current =>
            current.map(sv => {
              const entry = Object.entries(LABEL_MAP).find(([, v]) => v.label === sv.label)
              if (!entry) return sv
              const tag = entry[0]
              const newVal = updates[tag]
              if (newVal === undefined) return sv

              const prevVal = prev[tag]
              const trend = prevVal !== undefined
                ? newVal > prevVal ? 'up' as const : newVal < prevVal ? 'down' as const : sv.trend
                : sv.trend

              return { ...sv, value: newVal, trend }
            })
          )

          prevValuesRef.current = { ...prev, ...updates }
        }
      } catch {
        if (active) setConnected(false)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const getStatusColor = (status: SpotValue['status']) => {
    switch (status) {
      case 'critical': return '#E74C3C'
      case 'warning': return '#F39C12'
      default: return '#6EC72D'
    }
  }

  return (
    <Paper sx={{
      height: '100%', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.05em' }}>
          LIVE METRICS
        </Typography>
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%',
          bgcolor: connected ? '#6EC72D' : '#E74C3C',
        }} />
      </Box>

      <Box sx={{
        flex: 1, overflow: 'auto',
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'primary.dark', borderRadius: '3px' },
      }}>
        {spotValues.map((item, index) => (
          <React.Fragment key={item.label}>
            <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{
                color: 'text.secondary', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em'
              }}>
                {item.label}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h5" sx={{
                    color: getStatusColor(item.status), fontWeight: 700, fontSize: '1.5rem', lineHeight: 1
                  }}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    {item.unit}
                  </Typography>
                </Box>

                {item.trend && item.trend !== 'stable' && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {item.trend === 'up'
                      ? <TrendingUp sx={{ fontSize: 16, color: '#E67E22' }} />
                      : <TrendingDown sx={{ fontSize: 16, color: '#3498DB' }} />}
                  </Box>
                )}
              </Box>

              <Box sx={{
                width: '100%', height: 3, backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1, overflow: 'hidden', mt: 0.5
              }}>
                <Box sx={{
                  width: item.status === 'critical' ? '100%' : item.status === 'warning' ? '70%' : '100%',
                  height: '100%', backgroundColor: getStatusColor(item.status), transition: 'all 0.3s'
                }} />
              </Box>
            </Box>

            {index < spotValues.length - 1 && (
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Paper>
  )
}

export default SpotValues
