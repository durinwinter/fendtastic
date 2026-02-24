import React, { useEffect, useState } from 'react'
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material'
import { Circle as CircleIcon } from '@mui/icons-material'
import zenohService from '../services/zenohService'
import { useNavigate, useLocation } from 'react-router-dom'
import { styled } from '@mui/material/styles'

const NavChip = styled(Chip)(({ theme, color }) => ({
  borderRadius: 8,
  height: 32,
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  padding: '0 8px',
  backgroundColor: color === 'primary' ? theme.palette.primary.main : 'rgba(255,255,255,0.05)',
  border: `1px solid ${color === 'primary' ? theme.palette.primary.main : '#333'}`,
  color: '#fff',
  '&:hover': {
    backgroundColor: color === 'primary' ? theme.palette.primary.dark : 'rgba(255,255,255,0.1)',
  },
  '& .MuiChip-label': {
    paddingLeft: 12,
    paddingRight: 12,
  }
}))

const StatusChip = styled(Chip)(({ color }) => ({
  height: 24,
  borderRadius: 12,
  fontSize: '0.65rem',
  fontWeight: 800,
  backgroundColor: '#0B0B0B',
  border: `1px solid ${color === 'success' ? '#2ECC71' : '#E74C3C'}`,
  color: '#fff',
  '& .MuiChip-icon': {
    color: color === 'success' ? '#2ECC71' : '#E74C3C',
    fontSize: 10,
    marginLeft: 8
  }
}))

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [zenohConnected, setZenohConnected] = useState(false)
  const [evaIcsOnline, setEvaIcsOnline] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    const unsubscribeZenoh = zenohService.onConnectionChange((connected) => {
      setZenohConnected(connected)
      if (!connected) setEvaIcsOnline(false)
    })
    const unsubscribeEva = zenohService.subscribe('murph/status/eva-ics', (data) => {
      setEvaIcsOnline(!!(data && data.online))
    })
    return () => {
      clearInterval(timer)
      unsubscribeZenoh()
      unsubscribeEva()
    }
  }, [])

  return (
    <AppBar position="static" sx={{ height: 64, justifyContent: 'center' }}>
      <Toolbar sx={{ px: 3, display: 'flex', justifyContent: 'space-between' }}>
        {/* Left: Branding */}
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 1.5 }} onClick={() => navigate('/')}>
          <Box component="img" src="/heptapod-assets/sprites/people/coobie.png" sx={{ width: 32, height: 32 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '0.1em', fontFamily: 'Rajdhani' }}>
            MURPH CONTROL SYSTEM
          </Typography>
        </Box>

        {/* Center: Navigation */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <NavChip
            label="DASHBOARD"
            onClick={() => navigate('/')}
            color={location.pathname === '/' ? 'primary' : 'default'}
          />
          <NavChip
            label="PROCESS MONITOR"
            onClick={() => navigate('/heptapod')}
            color={location.pathname === '/heptapod' ? 'primary' : 'default'}
          />
          <NavChip
            label="PEA LAUNCHER"
            onClick={() => navigate('/pea-launcher')}
            color={location.pathname === '/pea-launcher' ? 'primary' : 'default'}
          />
          <NavChip
            label="MESH CONTROL"
            onClick={() => navigate('/heptapod-mesh')}
            color={location.pathname === '/heptapod-mesh' ? 'primary' : 'default'}
          />
        </Box>

        {/* Right: Status & Clock */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <StatusChip
            icon={<CircleIcon />}
            label={zenohConnected ? 'ZENOH CONNECTED' : 'ZENOH DISCONNECTED'}
            color={zenohConnected ? 'success' : 'error'}
          />
          <StatusChip
            icon={<CircleIcon />}
            label={evaIcsOnline ? 'EVA-ICS ONLINE' : 'EVA-ICS OFFLINE'}
            color={evaIcsOnline ? 'success' : 'error'}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 1, fontFamily: 'JetBrains Mono' }}>
            {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
