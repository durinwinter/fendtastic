import React, { useState, useEffect } from 'react'
import { Box, Typography, Paper, LinearProgress } from '@mui/material'
import Header from '../components/Header'
import apiService from '../services/apiService'

// Mars habitat simulation data — in production these would come from Zenoh bus
interface HabitatMetrics {
  surfaceTemp: number
  atmosphericPressure: number
  windSpeed: number
  interiorTemp: number
  oxygenRatio: number
  airflowRate: number
  humidity: number
  co2Level: number
  habitatPower: number
  labPower: number
  reservePower: number
  solarEfficiency: number
  batteryLevel: number
  reactorOutput: number
}

const DEFAULT_METRICS: HabitatMetrics = {
  surfaceTemp: -59,
  atmosphericPressure: 874,
  windSpeed: 18.6,
  interiorTemp: 22,
  oxygenRatio: 91.5,
  airflowRate: 20.5,
  humidity: 42,
  co2Level: 0.8,
  habitatPower: 88,
  labPower: 72,
  reservePower: 4.5,
  solarEfficiency: 67,
  batteryLevel: 85,
  reactorOutput: 94,
}

function addNoise(base: number, variance: number): number {
  return Math.round((base + (Math.random() - 0.5) * 2 * variance) * 10) / 10
}

// Styled metric card
const MetricCard: React.FC<{
  label: string
  value: string | number
  unit: string
  color?: string
  size?: 'sm' | 'lg'
}> = ({ label, value, unit, color = '#FFBF00', size = 'sm' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
    <Typography sx={{ color: '#888', fontSize: size === 'lg' ? '0.65rem' : '0.6rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{
        color,
        fontSize: size === 'lg' ? '1.8rem' : '1.3rem',
        fontWeight: 800,
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1,
      }}>
        {value}
      </Typography>
      <Typography sx={{ color: '#666', fontSize: '0.6rem', fontWeight: 600 }}>
        {unit}
      </Typography>
    </Box>
  </Box>
)

// Power bar
const PowerBar: React.FC<{
  label: string
  value: number
  max?: number
  color?: string
}> = ({ label, value, max = 100, color = '#FFBF00' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
    <Typography sx={{ color: '#aaa', fontSize: '0.6rem', fontWeight: 600, width: 90, flexShrink: 0, textAlign: 'right' }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1, position: 'relative' }}>
      <LinearProgress
        variant="determinate"
        value={Math.min((value / max) * 100, 100)}
        sx={{
          height: 8,
          borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
            borderRadius: 1,
          }
        }}
      />
    </Box>
    <Typography sx={{ color: '#ccc', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'JetBrains Mono', width: 40, textAlign: 'right' }}>
      {value}%
    </Typography>
  </Box>
)

// Status indicator
const StatusIndicator: React.FC<{
  label: string
  status: 'online' | 'warning' | 'offline'
}> = ({ label, status }) => {
  const colors = { online: '#2ECC71', warning: '#F39C12', offline: '#E74C3C' }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 1, border: `1px solid ${colors[status]}22` }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors[status], boxShadow: `0 0 6px ${colors[status]}` }} />
      <Typography sx={{ color: '#ccc', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.03em' }}>
        {label}
      </Typography>
    </Box>
  )
}

const MarsHabitat: React.FC = () => {
  const [metrics, setMetrics] = useState<HabitatMetrics>(DEFAULT_METRICS)
  const sol = 427

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        surfaceTemp: addNoise(prev.surfaceTemp, 1),
        atmosphericPressure: addNoise(prev.atmosphericPressure, 5),
        windSpeed: addNoise(prev.windSpeed, 2),
        interiorTemp: addNoise(22, 0.3),
        oxygenRatio: addNoise(91.5, 0.5),
        airflowRate: addNoise(20.5, 0.5),
        humidity: addNoise(42, 1),
        co2Level: addNoise(0.8, 0.05),
        habitatPower: addNoise(88, 2),
        labPower: addNoise(72, 3),
        reservePower: addNoise(4.5, 0.3),
        solarEfficiency: addNoise(67, 2),
        batteryLevel: addNoise(85, 1),
        reactorOutput: addNoise(94, 1),
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Also try to pick up real sensor data from Zenoh if available
  useEffect(() => {
    const poll = async () => {
      try {
        const latest = await apiService.getTsLatest()
        // Map any real sensor values to habitat metrics
        for (const [key, entry] of Object.entries(latest)) {
          if (!key.includes('/data/')) continue
          const tag = key.split('/').pop()
          const val = typeof entry.v === 'object' && entry.v !== null
            ? (entry.v as Record<string, unknown>).value as number
            : entry.v as number
          if (typeof val !== 'number') continue

          setMetrics(prev => {
            switch (tag) {
              case 'engine_temp': return { ...prev, surfaceTemp: Math.round(val - 144) } // offset for Mars surface temp
              case 'oil_pressure': return { ...prev, atmosphericPressure: Math.round(val * 19.4) } // scale to mBar
              case 'vibration': return { ...prev, windSpeed: Math.round(val * 0.53 * 10) / 10 }
              default: return prev
            }
          })
        }
      } catch { /* no backend */ }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0A0A0A', overflow: 'hidden' }}>
      <Header />

      {/* Sub-header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 0.75, borderBottom: '1px solid #1a1a1a', backgroundColor: '#0B0B0B' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ color: '#B7410E', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.1em', fontFamily: 'Rajdhani' }}>
            MARS BASE HABITAT CONTROL SYSTEM
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#FFBF00', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
            SOL {sol}
          </Typography>
          <Typography sx={{ color: '#666', fontSize: '0.65rem', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
            MTC 14:23:07
          </Typography>
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', p: 1.5, gap: 1.5 }}>

        {/* Left column */}
        <Box sx={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Site Overview */}
          <Paper sx={{ flex: '1 1 55%', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                SITE OVERVIEW
              </Typography>
            </Box>
            <Box sx={{
              flex: 1,
              background: 'radial-gradient(ellipse at 50% 80%, #2a1a0e 0%, #0a0a0a 70%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Mars terrain visualization */}
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(180deg, transparent 0%, #1a0e05 50%, #2a1608 100%)', opacity: 0.7 }} />

              {/* Habitat domes */}
              {[
                { x: '25%', y: '55%', size: 60, label: 'Habitat 1' },
                { x: '45%', y: '45%', size: 80, label: 'Habitat 2' },
                { x: '65%', y: '50%', size: 50, label: 'Habitat 3' },
                { x: '55%', y: '65%', size: 40, label: 'Comms' },
              ].map((dome, i) => (
                <Box key={i} sx={{
                  position: 'absolute',
                  left: dome.x,
                  top: dome.y,
                  transform: 'translate(-50%, -50%)',
                  width: dome.size,
                  height: dome.size * 0.5,
                  borderRadius: '50% 50% 0 0',
                  background: `radial-gradient(ellipse at 50% 100%, #3a2a1a 0%, rgba(183,65,14,0.3) 60%, transparent 100%)`,
                  border: '1px solid rgba(183,65,14,0.3)',
                  borderBottom: 'none',
                  boxShadow: '0 0 20px rgba(183,65,14,0.15)',
                  cursor: 'pointer',
                  '&:hover': { boxShadow: '0 0 30px rgba(183,65,14,0.3)' },
                }}>
                  <Typography sx={{
                    position: 'absolute',
                    bottom: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.5rem',
                    color: '#888',
                    whiteSpace: 'nowrap',
                  }}>
                    {dome.label}
                  </Typography>
                  {/* Status light */}
                  <Box sx={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', backgroundColor: '#2ECC71', boxShadow: '0 0 6px #2ECC71' }} />
                </Box>
              ))}

              {/* Solar panels */}
              {[35, 75].map((x, i) => (
                <Box key={`solar-${i}`} sx={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: '38%',
                  width: 24,
                  height: 16,
                  backgroundColor: 'rgba(52,152,219,0.3)',
                  border: '1px solid rgba(52,152,219,0.5)',
                  borderRadius: 0.5,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '1px',
                  padding: '2px',
                }}>
                  {Array(6).fill(0).map((_, j) => (
                    <Box key={j} sx={{ backgroundColor: 'rgba(52,152,219,0.5)', borderRadius: 0.25 }} />
                  ))}
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Power System + Electronics */}
          <Paper sx={{ flex: '0 0 auto', p: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                POWER SYSTEM
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <PowerBar label="Habitat Power" value={Math.round(metrics.habitatPower)} color="#FFBF00" />
              <PowerBar label="Lab Power" value={Math.round(metrics.labPower)} color="#3498DB" />
              <PowerBar label="Reserve Power" value={Math.round(metrics.reservePower * 22)} color="#2ECC71" />
              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <MetricCard label="Solar Eff." value={metrics.solarEfficiency} unit="%" color="#FFBF00" />
                <MetricCard label="Battery" value={metrics.batteryLevel} unit="%" color="#2ECC71" />
                <MetricCard label="Reactor" value={metrics.reactorOutput} unit="%" color="#3498DB" />
              </Box>
            </Box>
          </Paper>

          {/* Electronics Status */}
          <Paper sx={{ flex: '0 0 auto', p: 0 }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                ELECTRONICS
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <StatusIndicator label="ACTIVE" status="online" />
              <StatusIndicator label="SUPPORT A" status="online" />
              <StatusIndicator label="HABITAT 1" status="online" />
              <StatusIndicator label="TUNNEL 1" status="warning" />
              <StatusIndicator label="COMMS" status="online" />
              <StatusIndicator label="BACKUP" status="offline" />
            </Box>
          </Paper>
        </Box>

        {/* Right column */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Terraforming Dashboard */}
          <Paper sx={{ flex: '0 0 auto', p: 0 }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                TERRAFORMING DASHBOARD
              </Typography>
            </Box>
            <Box sx={{ p: 2, display: 'flex', gap: 4, justifyContent: 'center' }}>
              <MetricCard label="Surface Temp" value={`${metrics.surfaceTemp > 0 ? '+' : ''}${metrics.surfaceTemp}`} unit="°C" color="#B7410E" size="lg" />
              <MetricCard label="Atm. Pressure" value={metrics.atmosphericPressure} unit="mBar" color="#FFBF00" size="lg" />
              <MetricCard label="Wind Speed" value={metrics.windSpeed} unit="km/h" color="#3498DB" size="lg" />
            </Box>
          </Paper>

          {/* Atmosphere Control */}
          <Paper sx={{ flex: '0 0 auto', p: 0 }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                ATMOSPHERE CONTROL
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <MetricCard label="Interior Temp" value={metrics.interiorTemp} unit="°C" color="#2ECC71" />
                <MetricCard label="O2 Ratio" value={metrics.oxygenRatio} unit="%" color="#00D1FF" />
                <MetricCard label="Airflow Rate" value={metrics.airflowRate} unit="m/s" color="#FFBF00" />
              </Box>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <MetricCard label="Humidity" value={metrics.humidity} unit="%" color="#3498DB" />
                <MetricCard label="CO2 Level" value={metrics.co2Level} unit="%" color="#E74C3C" />
              </Box>
            </Box>
          </Paper>

          {/* Alert Log */}
          <Paper sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                HABITAT ALERTS
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
              {[
                { time: '14:21', msg: 'TEMP SENSOR RECALIBRATED — HAB 2', severity: 'info' as const },
                { time: '14:18', msg: 'SOLAR PANEL EFFICIENCY BELOW 70%', severity: 'warning' as const },
                { time: '14:12', msg: 'AIRLOCK CYCLE COMPLETED — TUNNEL 1', severity: 'info' as const },
                { time: '13:55', msg: 'BACKUP POWER OFFLINE — MAINTENANCE REQUIRED', severity: 'critical' as const },
                { time: '13:42', msg: 'CO2 SCRUBBER NOMINAL — HAB 1', severity: 'info' as const },
                { time: '13:30', msg: 'DUST STORM WARNING — SECTOR 7', severity: 'warning' as const },
              ].map((alert, i) => (
                <Box key={i} sx={{
                  display: 'flex',
                  gap: 1.5,
                  py: 0.75,
                  borderBottom: '1px solid #1a1a1a',
                  alignItems: 'center',
                }}>
                  <Box sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: alert.severity === 'critical' ? '#E74C3C' : alert.severity === 'warning' ? '#F39C12' : '#2ECC71',
                    boxShadow: `0 0 4px ${alert.severity === 'critical' ? '#E74C3C' : alert.severity === 'warning' ? '#F39C12' : '#2ECC71'}`,
                    flexShrink: 0,
                  }} />
                  <Typography sx={{ color: '#666', fontSize: '0.6rem', fontFamily: 'JetBrains Mono', flexShrink: 0 }}>
                    {alert.time}
                  </Typography>
                  <Typography sx={{ color: '#aaa', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.02em' }}>
                    {alert.msg}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Telemetry integration */}
          <Paper sx={{ flex: '0 0 auto', p: 0 }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                SYSTEM GAUGES
              </Typography>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { label: 'O2', value: 91.5, color: '#00D1FF' },
                  { label: 'N2', value: 78.1, color: '#3498DB' },
                  { label: 'PWR', value: 88, color: '#FFBF00' },
                  { label: 'H2O', value: 67, color: '#2ECC71' },
                ].map((gauge) => (
                  <Box key={gauge.label} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      border: `3px solid ${gauge.color}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      background: `conic-gradient(${gauge.color} ${gauge.value * 3.6}deg, transparent ${gauge.value * 3.6}deg)`,
                      mask: 'radial-gradient(closest-side, transparent 75%, black 76%)',
                      WebkitMask: 'radial-gradient(closest-side, transparent 75%, black 76%)',
                    }} />
                    <Typography sx={{ color: gauge.color, fontSize: '0.7rem', fontWeight: 700, fontFamily: 'JetBrains Mono', mt: -4.5 }}>
                      {gauge.value}
                    </Typography>
                    <Typography sx={{ color: '#666', fontSize: '0.5rem', fontWeight: 600 }}>
                      {gauge.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}

export default MarsHabitat
