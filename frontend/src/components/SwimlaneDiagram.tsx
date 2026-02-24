import React, { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import apiService from '../services/apiService'

interface SwimlanEvent {
  startMs: number
  endMs: number
  label: string
  color: string
}

interface LaneData {
  id: string
  label: string
  color: string
  events: SwimlanEvent[]
}

const STATE_COLORS: Record<string, string> = {
  IDLE: '#6EC72D',
  OPERATING: '#3498DB',
  MAINTENANCE: '#F39C12',
  STOPPED: '#95a5a6',
}

const ALARM_COLORS: Record<string, string> = {
  warning: '#F39C12',
  critical: '#E74C3C',
}

const POLL_INTERVAL = 2000
const WINDOW_MS = 5 * 60_000

function extractField(v: unknown, field: string): string | undefined {
  if (v && typeof v === 'object' && field in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)[field])
  }
  return undefined
}

const SwimlaneDiagram: React.FC = () => {
  const [lanes, setLanes] = useState<LaneData[]>([
    { id: 'machine-state', label: 'STATE', color: '#6EC72D', events: [] },
    { id: 'user-actions', label: 'ACTIONS', color: '#3498DB', events: [] },
    { id: 'alarms', label: 'ALARMS', color: '#E74C3C', events: [] },
  ])
  const [windowStart, setWindowStart] = useState(Date.now() - WINDOW_MS)
  const [windowEnd, setWindowEnd] = useState(Date.now())

  const fetchEvents = useCallback(async () => {
    const now = Date.now()
    const start = now - WINDOW_MS
    setWindowStart(start)
    setWindowEnd(now)

    try {
      const keys = await apiService.getTsKeys()
      const stateKey = (keys.keys || []).find((k: string) => k.includes('/swimlane/state'))
      const actionKey = (keys.keys || []).find((k: string) => k.includes('/swimlane/action'))
      const alarmKey = (keys.keys || []).find((k: string) => k.includes('/swimlane/alarm'))

      const results = await Promise.all([
        stateKey ? apiService.queryTimeSeries(stateKey, start, now) : null,
        actionKey ? apiService.queryTimeSeries(actionKey, start, now) : null,
        alarmKey ? apiService.queryTimeSeries(alarmKey, start, now) : null,
      ])

      const stateEvents: SwimlanEvent[] = []
      if (results[0]?.points?.length) {
        const pts = results[0].points
        let currentState = extractField(pts[0].v, 'state') || 'IDLE'
        let spanStart = pts[0].t

        for (let i = 1; i < pts.length; i++) {
          const state = extractField(pts[i].v, 'state') || currentState
          if (state !== currentState) {
            stateEvents.push({
              startMs: spanStart,
              endMs: pts[i].t,
              label: currentState,
              color: STATE_COLORS[currentState] || '#6EC72D',
            })
            currentState = state
            spanStart = pts[i].t
          }
        }
        stateEvents.push({
          startMs: spanStart,
          endMs: now,
          label: currentState,
          color: STATE_COLORS[currentState] || '#6EC72D',
        })
      }

      const actionEvents: SwimlanEvent[] = []
      if (results[1]?.points?.length) {
        for (const pt of results[1].points) {
          const action = extractField(pt.v, 'action')
          if (action) {
            actionEvents.push({
              startMs: pt.t - 1500,
              endMs: pt.t + 1500,
              label: action,
              color: '#3498DB',
            })
          }
        }
      }

      const alarmEvents: SwimlanEvent[] = []
      if (results[2]?.points?.length) {
        const pts = results[2].points
        let alarmStart: number | null = null
        let alarmLabel = ''
        let alarmSeverity = 'warning'

        for (const pt of pts) {
          const active = extractField(pt.v, 'active')
          const alarm = extractField(pt.v, 'alarm') || ''
          const severity = extractField(pt.v, 'severity') || 'warning'

          if (active === 'true' && alarm) {
            if (alarmStart === null) {
              alarmStart = pt.t
              alarmLabel = alarm
              alarmSeverity = severity
            }
          } else if (alarmStart !== null) {
            alarmEvents.push({
              startMs: alarmStart,
              endMs: pt.t,
              label: alarmLabel,
              color: ALARM_COLORS[alarmSeverity] || '#E74C3C',
            })
            alarmStart = null
          }
        }
        if (alarmStart !== null) {
          alarmEvents.push({
            startMs: alarmStart,
            endMs: now,
            label: alarmLabel,
            color: ALARM_COLORS[alarmSeverity] || '#E74C3C',
          })
        }
      }

      setLanes([
        { id: 'machine-state', label: 'STATE', color: '#6EC72D', events: stateEvents },
        { id: 'user-actions', label: 'ACTIONS', color: '#3498DB', events: actionEvents },
        { id: 'alarms', label: 'ALARMS', color: '#E74C3C', events: alarmEvents },
      ])
    } catch {
      // keep previous data
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const range = windowEnd - windowStart

  // Time axis labels (every minute)
  const timeLabels: { pct: number; label: string }[] = []
  const step = 60_000
  const firstTick = Math.ceil(windowStart / step) * step
  for (let t = firstTick; t <= windowEnd; t += step) {
    const pct = ((t - windowStart) / range) * 100
    timeLabels.push({ pct, label: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', px: 2, py: 1 }}>
      {/* Time axis */}
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

      {/* Compact lanes */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {lanes.map((lane) => (
          <Box key={lane.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Inline lane label */}
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
            {/* Lane track */}
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
                  <Tooltip key={idx} title={event.label} arrow placement="top">
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
