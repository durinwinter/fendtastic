import React, { useMemo } from 'react'
import { Box, Typography } from '@mui/material'

interface SwimlaneLane {
  id: string
  label: string
  color: string
  events: SwimlanEvent[]
}

interface SwimlanEvent {
  start: number // timestamp
  end: number // timestamp
  label: string
  state: string
}

const SwimlaneDiagram: React.FC = () => {
  // Mock data - in production, this would come from Zenoh
  const lanes: SwimlaneLane[] = useMemo(() => [
    {
      id: 'machine-state',
      label: 'MACHINE STATE',
      color: '#6EC72D',
      events: [
        { start: 0, end: 30, label: 'IDLE', state: 'idle' },
        { start: 30, end: 70, label: 'OPERATING', state: 'operating' },
        { start: 70, end: 85, label: 'MAINTENANCE', state: 'maintenance' },
        { start: 85, end: 100, label: 'OPERATING', state: 'operating' },
      ]
    },
    {
      id: 'user-actions',
      label: 'USER ACTIONS',
      color: '#3498DB',
      events: [
        { start: 28, end: 32, label: 'START', state: 'action' },
        { start: 68, end: 72, label: 'PAUSE', state: 'action' },
        { start: 83, end: 87, label: 'RESUME', state: 'action' },
      ]
    },
    {
      id: 'alarms',
      label: 'ALARMS',
      color: '#E74C3C',
      events: [
        { start: 45, end: 48, label: 'TEMP WARNING', state: 'warning' },
        { start: 65, end: 70, label: 'PRESSURE ALERT', state: 'critical' },
      ]
    },
  ], [])

  const timeRange = { start: 0, end: 100 }

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Time axis */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        mb: 1,
        px: 2,
        color: 'text.secondary',
        fontSize: '0.75rem'
      }}>
        {Array.from({ length: 11 }, (_, i) => (
          <Typography key={i} variant="caption" sx={{ fontSize: '0.7rem' }}>
            {String(i * 10).padStart(2, '0')}:00
          </Typography>
        ))}
      </Box>

      {/* Lanes */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {lanes.map((lane) => (
          <Box key={lane.id}>
            <Typography
              variant="caption"
              sx={{
                color: lane.color,
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.05em',
                mb: 0.5,
                display: 'block'
              }}
            >
              {lane.label}
            </Typography>
            <Box sx={{
              position: 'relative',
              height: 32,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {lane.events.map((event, idx) => {
                const left = ((event.start - timeRange.start) / (timeRange.end - timeRange.start)) * 100
                const width = ((event.end - event.start) / (timeRange.end - timeRange.start)) * 100

                return (
                  <Box
                    key={idx}
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '100%',
                      backgroundColor: lane.color,
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      '&:hover': {
                        opacity: 1,
                        zIndex: 10,
                      }
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        textAlign: 'center',
                        px: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {event.label}
                    </Typography>
                  </Box>
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
