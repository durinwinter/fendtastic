import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import apiService from '../services/apiService'

interface SpotValue {
  label: string
  value: string | number
  unit: string
  status: 'normal' | 'warning' | 'critical'
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

const SpotValues: React.FC = () => {
  const [spotValues, setSpotValues] = useState<SpotValue[]>(DEFAULT_VALUES)
  const prevValuesRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const latest = await apiService.getTsLatest()
        if (!active) return

        const updates: Record<string, number> = {}
        for (const [key, entry] of Object.entries(latest)) {
          // Only look at /data/ keys for sensor values
          if (!key.includes('/data/')) continue
          const tag = key.split('/').pop() || ''
          if (tag in LABEL_MAP) {
            const num = extractNumeric(entry.v)
            if (num !== null) updates[tag] = Math.round(num * 10) / 10
          }
        }

        if (Object.keys(updates).length > 0) {
          setSpotValues(current =>
            current.map(sv => {
              const entry = Object.entries(LABEL_MAP).find(([, v]) => v.label === sv.label)
              if (!entry) return sv
              const tag = entry[0]
              const newVal = updates[tag]
              if (newVal === undefined) return sv
              return { ...sv, value: newVal }
            })
          )
          prevValuesRef.current = { ...prevValuesRef.current, ...updates }
        }
      } catch { /* Ignore */ }
    }

    const interval = setInterval(poll, 1000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {spotValues.map((item) => (
        <Box key={item.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.02em' }}>
            {item.label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>
              {item.value}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              {item.unit}
            </Typography>
          </Box>
          <Box sx={{ height: 2, width: '100%', backgroundColor: '#222', mt: 0.5 }}>
            <Box sx={{ height: '100%', width: item.value === '--' ? '0%' : '100%', backgroundColor: '#6EC72D', transition: 'width 0.5s ease-in-out' }} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default SpotValues
