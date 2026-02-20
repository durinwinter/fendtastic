import React, { useState, useEffect } from 'react'
import { Box, Paper, Typography, Divider } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'
import zenohService from '../services/zenohService'

interface SpotValue {
  label: string
  value: string | number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
}

const DEFAULT_VALUES: SpotValue[] = [
  { label: 'Engine Temp', value: '--', unit: '°C', status: 'normal', trend: 'stable' },
  { label: 'Oil Pressure', value: '--', unit: 'PSI', status: 'normal', trend: 'stable' },
  { label: 'RPM', value: '--', unit: 'rpm', status: 'normal', trend: 'stable' },
  { label: 'Fuel Level', value: '--', unit: '%', status: 'normal', trend: 'stable' },
  { label: 'Hydraulic Temp', value: '--', unit: '°C', status: 'normal', trend: 'stable' },
  { label: 'Battery Voltage', value: '--', unit: 'V', status: 'normal', trend: 'stable' },
  { label: 'Coolant Level', value: '--', unit: '%', status: 'normal', trend: 'stable' },
  { label: 'Vibration', value: '--', unit: 'Hz', status: 'normal', trend: 'stable' },
]

const SpotValues: React.FC = () => {
  const [spotValues, setSpotValues] = useState<SpotValue[]>(DEFAULT_VALUES)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const unsubConn = zenohService.onConnectionChange(setConnected)

    // Subscribe to all fendtastic data for live updates
    const unsub = zenohService.subscribe('fendtastic/**', (data: any) => {
      if (!data) return

      // Handle EVA-ICS sensor updates
      if (data.oid && data.value !== undefined) {
        setSpotValues(prev => {
          // Try to match OID suffix to a known label
          const oid: string = data.oid
          const tag = oid.split('/').pop() || ''
          const labelMap: Record<string, string> = {
            engine_temp: 'Engine Temp',
            oil_pressure: 'Oil Pressure',
            rpm: 'RPM',
            fuel_level: 'Fuel Level',
            hydraulic_temp: 'Hydraulic Temp',
            battery_voltage: 'Battery Voltage',
            coolant_level: 'Coolant Level',
            vibration: 'Vibration',
          }
          const label = labelMap[tag]
          if (!label) return prev

          return prev.map(sv => {
            if (sv.label !== label) return sv
            const newVal = typeof data.value === 'number'
              ? Math.round(data.value * 10) / 10
              : data.value
            const prevNum = typeof sv.value === 'number' ? sv.value : 0
            const newNum = typeof newVal === 'number' ? newVal : 0
            return {
              ...sv,
              value: newVal,
              trend: newNum > prevNum ? 'up' as const : newNum < prevNum ? 'down' as const : sv.trend,
              status: data.status === 0 ? 'critical' as const : sv.status,
            }
          })
        })
      }
    })

    return () => { unsubConn(); unsub() }
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
