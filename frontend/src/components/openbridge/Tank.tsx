import React from 'react'
import { Box, Typography } from '@mui/material'

interface TankProps {
  name: string
  level: number
  capacity?: number
  color?: string
}

/**
 * OpenBridge-inspired vertical tank gauge.
 * Renders a filled bar with tick marks and numeric readout.
 */
const Tank: React.FC<TankProps> = ({ name, level, capacity = 100, color = '#00D1FF' }) => {
  const pct = Math.min(100, Math.max(0, (level / capacity) * 100))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{
        width: 44,
        height: 90,
        borderRadius: '4px',
        border: `1px solid ${color}33`,
        backgroundColor: '#0E0E0E',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${pct}%`,
          background: `linear-gradient(180deg, ${color}CC 0%, ${color}66 100%)`,
          transition: 'height 0.6s ease',
        }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {Math.round(pct)}
          </Typography>
        </Box>
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
      <Typography sx={{ color: '#888', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {name}
      </Typography>
      <Typography sx={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color, fontSize: '0.6rem' }}>
        {level.toFixed(1)}%
      </Typography>
    </Box>
  )
}

export default Tank
