import React, { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Paper } from '@mui/material'
import Header from '../components/Header'
import apiService from '../services/apiService'
import '../styles/openbridge-mars.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

interface Alert {
  time: string
  msg: string
  severity: 'info' | 'warning' | 'critical'
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

const ALERTS: Alert[] = [
  { time: '14:21', msg: 'TEMP SENSOR RECALIBRATED — HAB 2', severity: 'info' },
  { time: '14:18', msg: 'SOLAR PANEL EFFICIENCY BELOW 70%', severity: 'warning' },
  { time: '14:12', msg: 'AIRLOCK CYCLE COMPLETED — TUNNEL 1', severity: 'info' },
  { time: '13:55', msg: 'BACKUP POWER OFFLINE — MAINTENANCE', severity: 'critical' },
  { time: '13:42', msg: 'CO2 SCRUBBER NOMINAL — HAB 1', severity: 'info' },
  { time: '13:30', msg: 'DUST STORM WARNING — SECTOR 7', severity: 'warning' },
]

function addNoise(base: number, variance: number): number {
  return Math.round((base + (Math.random() - 0.5) * 2 * variance) * 10) / 10
}

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------
const SECTION_BORDER = '1px solid #1E1E1E'
const LABEL: React.CSSProperties = {
  color: '#6B6B6B',
  fontSize: '0.55rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  fontFamily: 'Rajdhani, sans-serif',
}
const VALUE_FONT: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 700,
  lineHeight: 1,
}
const SEVERITY_COLOR = {
  critical: '#E74C3C',
  warning: '#F39C12',
  info: '#2ECC71',
}

// ---------------------------------------------------------------------------
// Sub-components — OpenBridge-inspired clean industrial style
// ---------------------------------------------------------------------------

/** Section header bar used by every panel */
const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 1.5,
    py: 0.6,
    borderBottom: SECTION_BORDER,
    backgroundColor: 'rgba(255,255,255,0.015)',
  }}>
    <Typography sx={{ color: '#B7410E', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.1em', fontFamily: 'Rajdhani' }}>
      {title}
    </Typography>
    {right}
  </Box>
)

/** OpenBridge-style tank gauge — vertical bar with label and percentage */
const TankGauge: React.FC<{
  label: string
  value: number
  max?: number
  color: string
  unit?: string
}> = ({ label, value, max = 100, color, unit = '%' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
      {/* Tank body */}
      <Box sx={{
        width: 40,
        height: 80,
        borderRadius: '4px',
        border: `1px solid ${color}33`,
        backgroundColor: '#0E0E0E',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fill */}
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${pct}%`,
          background: `linear-gradient(180deg, ${color}CC 0%, ${color}66 100%)`,
          transition: 'height 0.6s ease',
        }} />
        {/* Value overlay */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Typography sx={{
            ...VALUE_FONT,
            color: '#fff',
            fontSize: '0.75rem',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {Math.round(pct)}
          </Typography>
        </Box>
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <Box key={tick} sx={{
            position: 'absolute',
            bottom: `${tick}%`,
            left: 0,
            width: 6,
            height: '1px',
            backgroundColor: `${color}44`,
          }} />
        ))}
      </Box>
      {/* Label */}
      <Typography sx={{ ...LABEL, color: '#888', fontSize: '0.5rem' }}>{label}</Typography>
      <Typography sx={{ ...VALUE_FONT, color, fontSize: '0.6rem' }}>
        {value.toFixed(1)}{unit}
      </Typography>
    </Box>
  )
}

/** OpenBridge-style readout — single metric with label/value/unit */
const Readout: React.FC<{
  label: string
  value: string | number
  unit: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}> = ({ label, value, unit, color = '#FFBF00', size = 'sm' }) => {
  const fontSize = size === 'lg' ? '1.6rem' : size === 'md' ? '1.1rem' : '0.9rem'
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0.25,
      p: 1,
      borderRadius: '3px',
      backgroundColor: 'rgba(255,255,255,0.02)',
      border: '1px solid #1A1A1A',
      minWidth: size === 'lg' ? 120 : 80,
    }}>
      <Typography sx={{ ...LABEL, fontSize: '0.5rem' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography sx={{ ...VALUE_FONT, color, fontSize }}>{value}</Typography>
        <Typography sx={{ color: '#555', fontSize: '0.5rem', fontWeight: 600 }}>{unit}</Typography>
      </Box>
    </Box>
  )
}

/** Horizontal power bar */
const PowerBar: React.FC<{
  label: string
  value: number
  max?: number
  color: string
}> = ({ label, value, max = 100, color }) => {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ ...LABEL, width: 80, textAlign: 'right', flexShrink: 0, fontSize: '0.5rem' }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 6, borderRadius: 1, backgroundColor: '#1A1A1A', overflow: 'hidden' }}>
        <Box sx={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 1,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width 0.6s ease',
        }} />
      </Box>
      <Typography sx={{ ...VALUE_FONT, color: '#ccc', fontSize: '0.6rem', width: 36, textAlign: 'right' }}>
        {Math.round(value)}%
      </Typography>
    </Box>
  )
}

/** Status badge — dot + label */
const StatusBadge: React.FC<{
  label: string
  status: 'online' | 'warning' | 'offline'
}> = ({ label, status }) => {
  const color = SEVERITY_COLOR[status === 'online' ? 'info' : status === 'warning' ? 'warning' : 'critical']
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.6,
      px: 1,
      py: 0.4,
      borderRadius: '3px',
      backgroundColor: `${color}08`,
      border: `1px solid ${color}22`,
    }}>
      <Box sx={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}88`,
      }} />
      <Typography sx={{ color: '#bbb', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.02em' }}>
        {label}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Site Overview SVG — cleaner vector-based habitat visualization
// ---------------------------------------------------------------------------
const SiteOverviewSVG: React.FC = () => (
  <svg viewBox="0 0 600 280" width="100%" height="100%" style={{ display: 'block' }}>
    {/* Terrain gradient */}
    <defs>
      <linearGradient id="terrain" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a0e05" stopOpacity="0" />
        <stop offset="60%" stopColor="#1a0e05" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#2a1608" stopOpacity="0.9" />
      </linearGradient>
      <radialGradient id="dome-glow" cx="50%" cy="100%" r="80%">
        <stop offset="0%" stopColor="#B7410E" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#B7410E" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="solar-panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3498DB" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#3498DB" stopOpacity="0.2" />
      </linearGradient>
    </defs>

    {/* Background terrain */}
    <rect x="0" y="100" width="600" height="180" fill="url(#terrain)" />

    {/* Connection tunnels */}
    <line x1="180" y1="200" x2="280" y2="180" stroke="#B7410E" strokeOpacity="0.2" strokeWidth="3" strokeDasharray="6 4" />
    <line x1="310" y1="180" x2="400" y2="190" stroke="#B7410E" strokeOpacity="0.2" strokeWidth="3" strokeDasharray="6 4" />
    <line x1="300" y1="195" x2="340" y2="220" stroke="#B7410E" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="4 4" />

    {/* Habitat 1 */}
    <ellipse cx="160" cy="200" rx="45" ry="22" fill="url(#dome-glow)" />
    <path d="M115,200 Q115,165 160,165 Q205,165 205,200" fill="none" stroke="#B7410E" strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="115" y1="200" x2="205" y2="200" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="160" cy="172" r="2.5" fill="#2ECC71" opacity="0.9" />
    <text x="160" y="216" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-1</text>

    {/* Habitat 2 (main) */}
    <ellipse cx="295" cy="185" rx="60" ry="30" fill="url(#dome-glow)" />
    <path d="M235,185 Q235,140 295,140 Q355,140 355,185" fill="none" stroke="#B7410E" strokeWidth="2" strokeOpacity="0.6" />
    <line x1="235" y1="185" x2="355" y2="185" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="295" cy="148" r="3" fill="#2ECC71" opacity="0.9" />
    <text x="295" y="202" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-2 PRIMARY</text>

    {/* Habitat 3 */}
    <ellipse cx="420" cy="195" rx="38" ry="18" fill="url(#dome-glow)" />
    <path d="M382,195 Q382,168 420,168 Q458,168 458,195" fill="none" stroke="#B7410E" strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="382" y1="195" x2="458" y2="195" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="420" cy="174" r="2.5" fill="#2ECC71" opacity="0.9" />
    <text x="420" y="210" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-3</text>

    {/* Comms tower */}
    <line x1="340" y1="225" x2="340" y2="245" stroke="#FFBF00" strokeWidth="1.5" strokeOpacity="0.5" />
    <circle cx="340" cy="222" r="4" fill="none" stroke="#FFBF00" strokeWidth="1" strokeOpacity="0.5" />
    <circle cx="340" cy="222" r="2" fill="#FFBF00" opacity="0.7" />
    <text x="340" y="256" textAnchor="middle" fill="#666" fontSize="8" fontFamily="Rajdhani">COMMS</text>

    {/* Solar array left */}
    <rect x="80" y="155" width="30" height="18" rx="1" fill="url(#solar-panel)" stroke="#3498DB" strokeWidth="0.5" strokeOpacity="0.4" />
    <line x1="85" y1="155" x2="85" y2="173" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="95" y1="155" x2="95" y2="173" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="105" y1="155" x2="105" y2="173" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />

    {/* Solar array right */}
    <rect x="480" y="165" width="30" height="18" rx="1" fill="url(#solar-panel)" stroke="#3498DB" strokeWidth="0.5" strokeOpacity="0.4" />
    <line x1="485" y1="165" x2="485" y2="183" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="495" y1="165" x2="495" y2="183" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="505" y1="165" x2="505" y2="183" stroke="#3498DB" strokeWidth="0.3" strokeOpacity="0.3" />
  </svg>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const MarsHabitat: React.FC = () => {
  const [metrics, setMetrics] = useState<HabitatMetrics>(DEFAULT_METRICS)
  const [sol] = useState(427)
  const [mtcTime, setMtcTime] = useState('14:23:07')

  // Simulated clock
  useEffect(() => {
    const tick = setInterval(() => {
      const d = new Date()
      setMtcTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  // Simulated metric updates
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

  // Real sensor data from Zenoh
  const pollSensors = useCallback(async () => {
    try {
      const latest = await apiService.getTsLatest()
      for (const [key, entry] of Object.entries(latest)) {
        if (!key.includes('/data/')) continue
        const tag = key.split('/').pop()
        const val = typeof entry.v === 'object' && entry.v !== null
          ? (entry.v as Record<string, unknown>).value as number
          : entry.v as number
        if (typeof val !== 'number') continue
        setMetrics(prev => {
          switch (tag) {
            case 'engine_temp': return { ...prev, surfaceTemp: Math.round(val - 144) }
            case 'oil_pressure': return { ...prev, atmosphericPressure: Math.round(val * 19.4) }
            case 'vibration': return { ...prev, windSpeed: Math.round(val * 0.53 * 10) / 10 }
            default: return prev
          }
        })
      }
    } catch { /* no backend */ }
  }, [])

  useEffect(() => {
    pollSensors()
    const interval = setInterval(pollSensors, 3000)
    return () => clearInterval(interval)
  }, [pollSensors])

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0A0A0A', overflow: 'hidden' }}>
      <Header />

      {/* ── Sub-header ── */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2.5,
        py: 0.5,
        borderBottom: SECTION_BORDER,
        backgroundColor: '#0B0B0B',
      }}>
        <Typography sx={{ color: '#B7410E', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'Rajdhani' }}>
          MARS BASE HABITAT CONTROL
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ ...VALUE_FONT, color: '#FFBF00', fontSize: '0.65rem' }}>SOL {sol}</Typography>
          <Typography sx={{ ...VALUE_FONT, color: '#555', fontSize: '0.6rem' }}>MTC {mtcTime}</Typography>
        </Box>
      </Box>

      {/* ── Dashboard Grid ── */}
      <Box sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1.2fr 0.6fr 0.5fr',
        gap: 1,
        p: 1,
        overflow: 'hidden',
      }}>

        {/* ┌─ Site Overview ─┐ */}
        <Paper sx={{ gridRow: '1', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SITE OVERVIEW" />
          <Box sx={{
            flex: 1,
            background: 'radial-gradient(ellipse at 50% 90%, #1a0e05 0%, #0a0a0a 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
          }}>
            <SiteOverviewSVG />
          </Box>
        </Paper>

        {/* ┌─ Terraforming + Atmosphere ─┐ */}
        <Paper sx={{ gridRow: '1', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="ENVIRONMENT" />
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1.5, gap: 1.5 }}>
            {/* Exterior */}
            <Box>
              <Typography sx={{ ...LABEL, fontSize: '0.48rem', mb: 0.75, color: '#555' }}>EXTERIOR</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Readout label="Surface Temp" value={`${metrics.surfaceTemp > 0 ? '+' : ''}${metrics.surfaceTemp}`} unit="°C" color="#B7410E" size="lg" />
                <Readout label="Atm. Pressure" value={metrics.atmosphericPressure} unit="mBar" color="#FFBF00" size="lg" />
                <Readout label="Wind Speed" value={metrics.windSpeed} unit="km/h" color="#3498DB" size="lg" />
              </Box>
            </Box>

            {/* Divider */}
            <Box sx={{ borderTop: SECTION_BORDER }} />

            {/* Interior */}
            <Box>
              <Typography sx={{ ...LABEL, fontSize: '0.48rem', mb: 0.75, color: '#555' }}>INTERIOR — HAB 2</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Readout label="Temp" value={metrics.interiorTemp} unit="°C" color="#2ECC71" />
                <Readout label="O₂" value={metrics.oxygenRatio} unit="%" color="#00D1FF" />
                <Readout label="Airflow" value={metrics.airflowRate} unit="m/s" color="#FFBF00" />
                <Readout label="Humidity" value={metrics.humidity} unit="%" color="#3498DB" />
                <Readout label="CO₂" value={metrics.co2Level} unit="%" color="#E74C3C" />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ┌─ Power System ─┐ */}
        <Paper sx={{ gridRow: '2', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="POWER SYSTEM" />
          <Box sx={{ flex: 1, display: 'flex', gap: 2, p: 1.5 }}>
            {/* Bars */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, justifyContent: 'center' }}>
              <PowerBar label="Habitat" value={Math.round(metrics.habitatPower)} color="#FFBF00" />
              <PowerBar label="Lab" value={Math.round(metrics.labPower)} color="#3498DB" />
              <PowerBar label="Reserve" value={Math.round(metrics.reservePower * 22)} color="#2ECC71" />
            </Box>
            {/* Key metrics */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, justifyContent: 'center' }}>
              <Readout label="Solar Eff." value={metrics.solarEfficiency.toFixed(0)} unit="%" color="#FFBF00" />
              <Readout label="Battery" value={metrics.batteryLevel.toFixed(0)} unit="%" color="#2ECC71" />
              <Readout label="Reactor" value={metrics.reactorOutput.toFixed(0)} unit="%" color="#3498DB" />
            </Box>
          </Box>
        </Paper>

        {/* ┌─ System Tanks ─┐ */}
        <Paper sx={{ gridRow: '2', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SYSTEM RESERVES" />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, p: 1.5 }}>
            <TankGauge label="O₂" value={metrics.oxygenRatio} color="#00D1FF" />
            <TankGauge label="N₂" value={78.1} color="#3498DB" />
            <TankGauge label="PWR" value={metrics.habitatPower} color="#FFBF00" />
            <TankGauge label="H₂O" value={67} color="#2ECC71" />
            <TankGauge label="CO₂" value={metrics.co2Level} max={5} color="#E74C3C" />
          </Box>
        </Paper>

        {/* ┌─ Electronics Status ─┐ */}
        <Paper sx={{ gridRow: '3', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SUBSYSTEM STATUS" />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75, p: 1.5, flexWrap: 'wrap' }}>
            <StatusBadge label="CORE SYSTEMS" status="online" />
            <StatusBadge label="LIFE SUPPORT A" status="online" />
            <StatusBadge label="HABITAT 1" status="online" />
            <StatusBadge label="HABITAT 2" status="online" />
            <StatusBadge label="TUNNEL 1" status="warning" />
            <StatusBadge label="COMMS" status="online" />
            <StatusBadge label="BACKUP GEN" status="offline" />
          </Box>
        </Paper>

        {/* ┌─ Alert Log ─┐ */}
        <Paper sx={{ gridRow: '3', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="HABITAT ALERTS" />
          <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 0.5 }}>
            {ALERTS.map((alert, i) => (
              <Box key={i} sx={{
                display: 'flex',
                gap: 1,
                py: 0.5,
                borderBottom: i < ALERTS.length - 1 ? SECTION_BORDER : 'none',
                alignItems: 'center',
              }}>
                <Box sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: SEVERITY_COLOR[alert.severity],
                  boxShadow: `0 0 4px ${SEVERITY_COLOR[alert.severity]}88`,
                  flexShrink: 0,
                }} />
                <Typography sx={{ ...VALUE_FONT, color: '#555', fontSize: '0.55rem', flexShrink: 0 }}>
                  {alert.time}
                </Typography>
                <Typography sx={{ color: '#999', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.01em' }}>
                  {alert.msg}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}

export default MarsHabitat
