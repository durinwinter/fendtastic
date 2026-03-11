import React, { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper } from '@mui/material'
import zenohService from '../services/zenohService'
import '../styles/openbridge-mars.css'
import EntShellScaffold from '../components/layout/EntShellScaffold'

interface HabitatMetrics {
  surfaceTemp: number | null
  atmosphericPressure: number | null
  windSpeed: number | null
  interiorTemp: number | null
  oxygenRatio: number | null
  airflowRate: number | null
  humidity: number | null
  co2Level: number | null
  habitatPower: number | null
  labPower: number | null
  reservePower: number | null
  solarEfficiency: number | null
  batteryLevel: number | null
  reactorOutput: number | null
}

interface LiveAlert {
  time: string
  msg: string
  severity: 'info' | 'warning' | 'critical'
}

interface LiveSubsystem {
  id: string
  label: string
  status: 'online' | 'warning' | 'offline'
  lastSeen: number
}

const EMPTY_METRICS: HabitatMetrics = {
  surfaceTemp: null,
  atmosphericPressure: null,
  windSpeed: null,
  interiorTemp: null,
  oxygenRatio: null,
  airflowRate: null,
  humidity: null,
  co2Level: null,
  habitatPower: null,
  labPower: null,
  reservePower: null,
  solarEfficiency: null,
  batteryLevel: null,
  reactorOutput: null,
}

const TAG_TO_METRIC: Record<string, keyof HabitatMetrics> = {
  surface_temp: 'surfaceTemp',
  ambient_temp: 'surfaceTemp',
  engine_temp: 'surfaceTemp',
  atmospheric_pressure: 'atmosphericPressure',
  oil_pressure: 'atmosphericPressure',
  wind_speed: 'windSpeed',
  vibration: 'windSpeed',
  interior_temp: 'interiorTemp',
  oxygen_ratio: 'oxygenRatio',
  oxygen_level: 'oxygenRatio',
  airflow_rate: 'airflowRate',
  humidity: 'humidity',
  co2_level: 'co2Level',
  habitat_power: 'habitatPower',
  lab_power: 'labPower',
  reserve_power: 'reservePower',
  solar_efficiency: 'solarEfficiency',
  battery_level: 'batteryLevel',
  reactor_output: 'reactorOutput',
}

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

function formatNumeric(value: number | null, digits = 1): string {
  return value == null ? '--' : value.toFixed(digits)
}

function extractNumeric(payload: unknown): number | null {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'string') {
    const parsed = parseFloat(payload)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    return extractNumeric(record.value ?? record.v ?? record.data ?? record.val)
  }
  return null
}

function prettySubsystemName(id: string): string {
  return id
    .split(/[_-]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

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

const TankGauge: React.FC<{ label: string; value: number | null; max?: number; color: string; unit?: string }> = ({ label, value, max = 100, color, unit = '%' }) => {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
      <Box sx={{ width: 40, height: 80, borderRadius: '4px', border: `1px solid ${color}33`, backgroundColor: '#0E0E0E', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `linear-gradient(180deg, ${color}CC 0%, ${color}66 100%)`, transition: 'height 0.6s ease' }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ ...VALUE_FONT, color: '#fff', fontSize: '0.75rem', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {value == null ? '--' : Math.round(pct)}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ ...LABEL, color: '#888', fontSize: '0.5rem' }}>{label}</Typography>
      <Typography sx={{ ...VALUE_FONT, color, fontSize: '0.6rem' }}>
        {value == null ? '--' : value.toFixed(1)}{value == null ? '' : unit}
      </Typography>
    </Box>
  )
}

const Readout: React.FC<{ label: string; value: string | number | null; unit: string; color?: string; size?: 'sm' | 'md' | 'lg' }> = ({ label, value, unit, color = '#FFBF00', size = 'sm' }) => {
  const fontSize = size === 'lg' ? '1.6rem' : size === 'md' ? '1.1rem' : '0.9rem'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, p: 1, borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #1A1A1A', minWidth: size === 'lg' ? 120 : 80 }}>
      <Typography sx={{ ...LABEL, fontSize: '0.5rem' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography sx={{ ...VALUE_FONT, color, fontSize }}>{value == null ? '--' : value}</Typography>
        {value != null && <Typography sx={{ color: '#555', fontSize: '0.5rem', fontWeight: 600 }}>{unit}</Typography>}
      </Box>
    </Box>
  )
}

const PowerBar: React.FC<{ label: string; value: number | null; max?: number; color: string }> = ({ label, value, max = 100, color }) => {
  const pct = value == null ? 0 : Math.min(100, (value / max) * 100)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ ...LABEL, width: 80, textAlign: 'right', flexShrink: 0, fontSize: '0.5rem' }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 6, borderRadius: 1, backgroundColor: '#1A1A1A', overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 1, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.6s ease' }} />
      </Box>
      <Typography sx={{ ...VALUE_FONT, color: '#ccc', fontSize: '0.6rem', width: 48, textAlign: 'right' }}>
        {value == null ? '--' : `${Math.round(value)}%`}
      </Typography>
    </Box>
  )
}

const StatusBadge: React.FC<{ label: string; status: 'online' | 'warning' | 'offline' }> = ({ label, status }) => {
  const color = SEVERITY_COLOR[status === 'online' ? 'info' : status === 'warning' ? 'warning' : 'critical']
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.4, borderRadius: '3px', backgroundColor: `${color}08`, border: `1px solid ${color}22` }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 4px ${color}88` }} />
      <Typography sx={{ color: '#bbb', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.02em' }}>{label}</Typography>
    </Box>
  )
}

const SiteOverviewSVG: React.FC = () => (
  <svg viewBox="0 0 600 280" width="100%" height="100%" style={{ display: 'block' }}>
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
    <rect x="0" y="100" width="600" height="180" fill="url(#terrain)" />
    <line x1="180" y1="200" x2="280" y2="180" stroke="#B7410E" strokeOpacity="0.2" strokeWidth="3" strokeDasharray="6 4" />
    <line x1="310" y1="180" x2="400" y2="190" stroke="#B7410E" strokeOpacity="0.2" strokeWidth="3" strokeDasharray="6 4" />
    <line x1="300" y1="195" x2="340" y2="220" stroke="#B7410E" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="4 4" />
    <ellipse cx="160" cy="200" rx="45" ry="22" fill="url(#dome-glow)" />
    <path d="M115,200 Q115,165 160,165 Q205,165 205,200" fill="none" stroke="#B7410E" strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="115" y1="200" x2="205" y2="200" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="160" cy="172" r="2.5" fill="#2ECC71" opacity="0.9" />
    <text x="160" y="216" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-1</text>
    <ellipse cx="295" cy="185" rx="60" ry="30" fill="url(#dome-glow)" />
    <path d="M235,185 Q235,140 295,140 Q355,140 355,185" fill="none" stroke="#B7410E" strokeWidth="2" strokeOpacity="0.6" />
    <line x1="235" y1="185" x2="355" y2="185" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="295" cy="148" r="3" fill="#2ECC71" opacity="0.9" />
    <text x="295" y="202" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-2 PRIMARY</text>
    <ellipse cx="420" cy="195" rx="38" ry="18" fill="url(#dome-glow)" />
    <path d="M382,195 Q382,168 420,168 Q458,168 458,195" fill="none" stroke="#B7410E" strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="382" y1="195" x2="458" y2="195" stroke="#B7410E" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="420" cy="174" r="2.5" fill="#2ECC71" opacity="0.9" />
    <text x="420" y="210" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Rajdhani">HAB-3</text>
    <line x1="340" y1="225" x2="340" y2="245" stroke="#FFBF00" strokeWidth="1.5" strokeOpacity="0.5" />
    <circle cx="340" cy="222" r="4" fill="none" stroke="#FFBF00" strokeWidth="1" strokeOpacity="0.5" />
    <circle cx="340" cy="222" r="2" fill="#FFBF00" opacity="0.7" />
    <text x="340" y="256" textAnchor="middle" fill="#666" fontSize="8" fontFamily="Rajdhani">COMMS</text>
    <rect x="80" y="155" width="30" height="18" rx="1" fill="url(#solar-panel)" stroke="#3498DB" strokeWidth="0.5" strokeOpacity="0.4" />
    <rect x="480" y="165" width="30" height="18" rx="1" fill="url(#solar-panel)" stroke="#3498DB" strokeWidth="0.5" strokeOpacity="0.4" />
  </svg>
)

const MarsHabitat: React.FC = () => {
  const [metrics, setMetrics] = useState<HabitatMetrics>(EMPTY_METRICS)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [alerts, setAlerts] = useState<LiveAlert[]>([])
  const [subsystems, setSubsystems] = useState<Record<string, LiveSubsystem>>({})

  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000)

    const unsubData = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/data/+', (payload) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      const tag = key.split('/').pop() || ''
      const metric = TAG_TO_METRIC[tag]
      if (!metric) return
      const value = extractNumeric(payload)
      if (value == null) return
      setMetrics((current) => ({ ...current, [metric]: Math.round(value * 10) / 10 }))
    })

    const unsubStatus = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/status', (payload) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      const parts = key.split('/')
      const peaIndex = parts.indexOf('pea')
      const peaId = peaIndex >= 0 && peaIndex < parts.length - 1 ? parts[peaIndex + 1] : 'pea'
      const status: 'online' | 'warning' | 'offline' = payload?.running === true
        ? 'online'
        : payload?.deployed === true
          ? 'warning'
          : 'offline'
      setSubsystems((current) => ({
        ...current,
        [peaId]: {
          id: peaId,
          label: prettySubsystemName(peaId),
          status,
          lastSeen: Date.now(),
        },
      }))
    })

    const unsubAlarm = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/swimlane/alarm', (payload) => {
      const severity = payload && typeof payload === 'object' && typeof payload.severity === 'string'
        ? payload.severity.toLowerCase() as LiveAlert['severity']
        : 'warning'
      const message = payload && typeof payload === 'object' && typeof payload.alarm === 'string'
        ? payload.alarm
        : 'Live habitat alarm'
      setAlerts((current) => [{
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        msg: message,
        severity,
      }, ...current].slice(0, 6))
    })

    return () => {
      clearInterval(clock)
      unsubData()
      unsubStatus()
      unsubAlarm()
    }
  }, [])

  const subsystemList = useMemo(() => {
    const now = Date.now()
    return Object.values(subsystems)
      .map((subsystem) => ({
        ...subsystem,
        status: now - subsystem.lastSeen > 20_000 ? 'offline' : subsystem.status,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 7)
  }, [subsystems])

  const liveTagCount = useMemo(() => Object.values(metrics).filter((value) => value != null).length, [metrics])

  return (
    <EntShellScaffold contentSx={{ overflow: 'auto' }}>
      <Box sx={{ height: '100%', overflow: 'auto', pr: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, py: 0.5, borderBottom: SECTION_BORDER, backgroundColor: '#0B0B0B', borderRadius: '18px' }}>
        <Typography sx={{ color: '#B7410E', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'Rajdhani' }}>
          MARS BASE HABITAT CONTROL
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ ...VALUE_FONT, color: '#FFBF00', fontSize: '0.65rem' }}>LIVE TAGS {liveTagCount}</Typography>
          <Typography sx={{ ...VALUE_FONT, color: '#555', fontSize: '0.6rem' }}>{currentTime.toLocaleTimeString()}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.2fr 0.6fr 0.5fr', gap: 1, py: 1, minHeight: 780, overflow: 'hidden' }}>
        <Paper sx={{ gridRow: '1', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SITE OVERVIEW" />
          <Box sx={{ flex: 1, background: 'radial-gradient(ellipse at 50% 90%, #1a0e05 0%, #0a0a0a 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
            <SiteOverviewSVG />
          </Box>
        </Paper>

        <Paper sx={{ gridRow: '1', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="ENVIRONMENT" />
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1.5, gap: 1.5 }}>
            <Box>
              <Typography sx={{ ...LABEL, fontSize: '0.48rem', mb: 0.75, color: '#555' }}>EXTERIOR</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Readout label="Surface Temp" value={formatNumeric(metrics.surfaceTemp, 0)} unit="°C" color="#B7410E" size="lg" />
                <Readout label="Atm. Pressure" value={formatNumeric(metrics.atmosphericPressure, 0)} unit="mBar" color="#FFBF00" size="lg" />
                <Readout label="Wind Speed" value={formatNumeric(metrics.windSpeed, 1)} unit="km/h" color="#3498DB" size="lg" />
              </Box>
            </Box>
            <Box sx={{ borderTop: SECTION_BORDER }} />
            <Box>
              <Typography sx={{ ...LABEL, fontSize: '0.48rem', mb: 0.75, color: '#555' }}>INTERIOR</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Readout label="Temp" value={formatNumeric(metrics.interiorTemp, 1)} unit="°C" color="#2ECC71" />
                <Readout label="O₂" value={formatNumeric(metrics.oxygenRatio, 1)} unit="%" color="#00D1FF" />
                <Readout label="Airflow" value={formatNumeric(metrics.airflowRate, 1)} unit="m/s" color="#FFBF00" />
                <Readout label="Humidity" value={formatNumeric(metrics.humidity, 1)} unit="%" color="#3498DB" />
                <Readout label="CO₂" value={formatNumeric(metrics.co2Level, 2)} unit="%" color="#E74C3C" />
              </Box>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ gridRow: '2', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="POWER SYSTEM" />
          <Box sx={{ flex: 1, display: 'flex', gap: 2, p: 1.5 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, justifyContent: 'center' }}>
              <PowerBar label="Habitat" value={metrics.habitatPower} color="#FFBF00" />
              <PowerBar label="Lab" value={metrics.labPower} color="#3498DB" />
              <PowerBar label="Reserve" value={metrics.reservePower} color="#2ECC71" />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, justifyContent: 'center' }}>
              <Readout label="Solar Eff." value={formatNumeric(metrics.solarEfficiency, 0)} unit="%" color="#FFBF00" />
              <Readout label="Battery" value={formatNumeric(metrics.batteryLevel, 0)} unit="%" color="#2ECC71" />
              <Readout label="Reactor" value={formatNumeric(metrics.reactorOutput, 0)} unit="%" color="#3498DB" />
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ gridRow: '2', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SYSTEM RESERVES" />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, p: 1.5 }}>
            <TankGauge label="O₂" value={metrics.oxygenRatio} color="#00D1FF" />
            <TankGauge label="PWR" value={metrics.habitatPower} color="#FFBF00" />
            <TankGauge label="SOL" value={metrics.solarEfficiency} color="#2ECC71" />
            <TankGauge label="BATT" value={metrics.batteryLevel} color="#3498DB" />
            <TankGauge label="CO₂" value={metrics.co2Level} max={5} color="#E74C3C" />
          </Box>
        </Paper>

        <Paper sx={{ gridRow: '3', gridColumn: '1', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="SUBSYSTEM STATUS" />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75, p: 1.5, flexWrap: 'wrap' }}>
            {subsystemList.length > 0 ? subsystemList.map((subsystem) => (
              <StatusBadge key={subsystem.id} label={subsystem.label} status={subsystem.status} />
            )) : <StatusBadge label="NO LIVE PEAS" status="offline" />}
          </Box>
        </Paper>

        <Paper sx={{ gridRow: '3', gridColumn: '2', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHeader title="HABITAT ALERTS" />
          <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 0.5 }}>
            {alerts.length > 0 ? alerts.map((alert, i) => (
              <Box key={`${alert.time}-${i}`} sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: i < alerts.length - 1 ? SECTION_BORDER : 'none', alignItems: 'center' }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: SEVERITY_COLOR[alert.severity], boxShadow: `0 0 4px ${SEVERITY_COLOR[alert.severity]}88`, flexShrink: 0 }} />
                <Typography sx={{ ...VALUE_FONT, color: '#555', fontSize: '0.55rem', flexShrink: 0 }}>{alert.time}</Typography>
                <Typography sx={{ color: '#999', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.01em' }}>{alert.msg}</Typography>
              </Box>
            )) : (
              <Typography sx={{ color: '#666', fontSize: '0.65rem', py: 1 }}>No live alarm traffic on entmoot yet.</Typography>
            )}
          </Box>
        </Paper>
      </Box>
      </Box>
    </EntShellScaffold>
  )
}

export default MarsHabitat
