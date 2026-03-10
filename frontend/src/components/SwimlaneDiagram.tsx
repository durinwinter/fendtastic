import React, { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import zenohService from '../services/zenohService'

type SwimlaneEvent = {
  startMs: number
  endMs: number
  label: string
  color: string
}

type LaneData = {
  id: string
  label: string
  color: string
  events: SwimlaneEvent[]
}

const WINDOW_MS = 5 * 60_000
const TICK_MS = 2000

const STATE_COLORS: Record<string, string> = {
  running: '#6EC72D',
  deployed: '#3498DB',
  idle: '#95a5a6',
  stopped: '#95a5a6',
}

const ACTION_COLORS: Record<string, string> = {
  start: '#3498DB',
  stop: '#F39C12',
  deploy: '#8E6DD8',
  undeploy: '#A1553A',
}

const ALARM_COLORS: Record<string, string> = {
  info: '#2ECC71',
  warning: '#F39C12',
  critical: '#E74C3C',
}

function labelForStatus(payload: Record<string, unknown>): string {
  if (payload.running === true) return 'running'
  if (payload.deployed === true) return 'deployed'
  return 'idle'
}

function addEvent(
  setter: React.Dispatch<React.SetStateAction<LaneData[]>>,
  laneId: string,
  event: SwimlaneEvent,
) {
  setter((current) => current.map((lane) => {
    if (lane.id !== laneId) return lane
    const next = [...lane.events, event].filter((item) => item.endMs >= Date.now() - WINDOW_MS)
    return { ...lane, events: next }
  }))
}

const SwimlaneDiagram: React.FC = () => {
  const [windowEnd, setWindowEnd] = useState(Date.now())
  const [lanes, setLanes] = useState<LaneData[]>([
    { id: 'machine-state', label: 'STATE', color: '#6EC72D', events: [] },
    { id: 'user-actions', label: 'ACTIONS', color: '#3498DB', events: [] },
    { id: 'alarms', label: 'ALARMS', color: '#E74C3C', events: [] },
  ])

  useEffect(() => {
    const unsubStatus = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/status', (payload) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      const parts = key.split('/')
      const peaIndex = parts.indexOf('pea')
      const peaId = peaIndex >= 0 && peaIndex < parts.length - 1 ? parts[peaIndex + 1] : 'pea'
      const statusLabel = payload && typeof payload === 'object'
        ? labelForStatus(payload as Record<string, unknown>)
        : 'idle'
      const now = Date.now()
      addEvent(setLanes, 'machine-state', {
        startMs: now,
        endMs: now + 12_000,
        label: `${peaId} ${statusLabel}`,
        color: STATE_COLORS[statusLabel] || '#6EC72D',
      })
      setWindowEnd(now)
    })

    const unsubActions = zenohService.subscribe('entmoot/runtime/nodes/+/pea/+/lifecycle', (payload) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      const parts = key.split('/')
      const peaIndex = parts.indexOf('pea')
      const peaId = peaIndex >= 0 && peaIndex < parts.length - 1 ? parts[peaIndex + 1] : 'pea'
      const action = payload && typeof payload === 'object' && typeof payload.action === 'string'
        ? payload.action.toLowerCase()
        : 'event'
      const now = Date.now()
      addEvent(setLanes, 'user-actions', {
        startMs: now,
        endMs: now + 4000,
        label: `${peaId} ${action}`,
        color: ACTION_COLORS[action] || '#3498DB',
      })
      setWindowEnd(now)
    })

    const unsubAlarms = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/swimlane/alarm', (payload) => {
      const severity = payload && typeof payload === 'object' && typeof payload.severity === 'string'
        ? payload.severity.toLowerCase()
        : 'warning'
      const alarmLabel = payload && typeof payload === 'object' && typeof payload.alarm === 'string'
        ? payload.alarm
        : 'alarm'
      const now = Date.now()
      addEvent(setLanes, 'alarms', {
        startMs: now,
        endMs: now + 15_000,
        label: alarmLabel,
        color: ALARM_COLORS[severity] || '#E74C3C',
      })
      setWindowEnd(now)
    })

    const timer = setInterval(() => {
      const now = Date.now()
      setWindowEnd(now)
      setLanes((current) => current.map((lane) => ({
        ...lane,
        events: lane.events.filter((event) => event.endMs >= now - WINDOW_MS),
      })))
    }, TICK_MS)

    return () => {
      unsubStatus()
      unsubActions()
      unsubAlarms()
      clearInterval(timer)
    }
  }, [])

  const windowStart = windowEnd - WINDOW_MS
  const range = WINDOW_MS

  const timeLabels = useMemo(() => {
    const ticks: Array<{ pct: number; label: string }> = []
    const step = 60_000
    const firstTick = Math.ceil(windowStart / step) * step
    for (let t = firstTick; t <= windowEnd; t += step) {
      ticks.push({
        pct: ((t - windowStart) / range) * 100,
        label: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })
    }
    return ticks
  }, [range, windowEnd, windowStart])

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', px: 2, py: 1 }}>
      <Box sx={{ position: 'relative', height: 16, mb: 0.5, flexShrink: 0 }}>
        {timeLabels.map((tick, i) => (
          <Typography
            key={i}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${tick.pct}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.65rem',
              color: 'text.secondary',
              userSelect: 'none',
            }}
          >
            {tick.label}
          </Typography>
        ))}
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {lanes.map((lane) => (
          <Box key={lane.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: lane.color,
                fontWeight: 700,
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
                width: 52,
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {lane.label}
            </Typography>
            <Box sx={{
              position: 'relative',
              flex: 1,
              height: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 0.5,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}>
              {lane.events.map((event, idx) => {
                const left = Math.max(0, ((event.startMs - windowStart) / range) * 100)
                const right = Math.min(100, ((event.endMs - windowStart) / range) * 100)
                const width = right - left
                if (width <= 0) return null

                return (
                  <Tooltip key={`${lane.id}-${idx}-${event.startMs}`} title={event.label} arrow placement="top">
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        height: '100%',
                        backgroundColor: event.color,
                        opacity: 0.85,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'default',
                        transition: 'opacity 0.15s',
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      {width > 5 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#000',
                            fontWeight: 700,
                            fontSize: '0.55rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            px: 0.5,
                          }}
                        >
                          {event.label}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default SwimlaneDiagram
