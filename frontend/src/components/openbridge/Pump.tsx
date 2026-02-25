import React from 'react'
import { Box, Typography } from '@mui/material'

interface PumpProps {
  name: string
  isRunning: boolean
}

/**
 * OpenBridge-inspired pump indicator.
 * Circle with directional triangle, colored by running state.
 */
const Pump: React.FC<PumpProps> = ({ name, isRunning }) => {
  const color = isRunning ? '#2ECC71' : '#555'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="13" fill="none" stroke={color} strokeWidth="2" />
        <polygon points="12,9 12,23 24,16" fill={color} opacity="0.8" />
      </svg>
      <Typography sx={{ color: '#888', fontSize: '0.5rem', fontWeight: 600 }}>{name}</Typography>
    </Box>
  )
}

export default Pump
