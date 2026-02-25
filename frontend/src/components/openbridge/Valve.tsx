import React from 'react'
import { Box, Typography } from '@mui/material'

interface ValveProps {
  name: string
  isOpen: boolean
}

/**
 * OpenBridge-inspired valve indicator.
 * Shows a bowtie shape that's green when open, grey when closed.
 */
const Valve: React.FC<ValveProps> = ({ name, isOpen }) => {
  const color = isOpen ? '#2ECC71' : '#555'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <polygon points="4,4 12,12 4,20" fill={color} opacity="0.8" />
        <polygon points="20,4 12,12 20,20" fill={color} opacity="0.8" />
        <circle cx="12" cy="12" r="2" fill={isOpen ? '#fff' : '#888'} />
      </svg>
      <Typography sx={{ color: '#888', fontSize: '0.5rem', fontWeight: 600 }}>{name}</Typography>
    </Box>
  )
}

export default Valve
