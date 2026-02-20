import React, { useEffect, useState } from 'react'
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material'
import { Circle as CircleIcon } from '@mui/icons-material'
import zenohService from '../services/zenohService'

import { useNavigate, useLocation } from 'react-router-dom'

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [zenohConnected, setZenohConnected] = useState(false)
  const [evaIcsOnline, setEvaIcsOnline] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    // Zenoh connection status
    const unsubscribeZenoh = zenohService.onConnectionChange((connected) => {
      setZenohConnected(connected)
      if (!connected) {
        setEvaIcsOnline(false)
      }
    })

    // EVA-ICS status subscription
    const unsubscribeEva = zenohService.subscribe('fendtastic/status/eva-ics', (data) => {
      if (data && data.online) {
        setEvaIcsOnline(true)
      } else {
        setEvaIcsOnline(false)
      }
    })

    return () => {
      clearInterval(timer)
      unsubscribeZenoh()
      unsubscribeEva()
    }
  }, [])

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: 'background.paper',
        borderBottom: '2px solid',
        borderColor: 'primary.main',
        boxShadow: 'none'
      }}
    >
      <Toolbar>
        <Typography
          variant="h5"
          component="div"
          sx={{
            flexGrow: 0,
            fontWeight: 700,
            color: 'primary.main',
            letterSpacing: '0.05em',
            mr: 4,
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          FENDTASTIC CONTROL SYSTEM
        </Typography>

        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
          <Chip
            label="DASHBOARD"
            onClick={() => navigate('/')}
            color={location.pathname === '/' ? 'primary' : 'default'}
            variant={location.pathname === '/' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip
            label="HEPTAPOD"
            onClick={() => navigate('/heptapod')}
            color={location.pathname === '/heptapod' ? 'primary' : 'default'}
            variant={location.pathname === '/heptapod' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip
            label="PEA LAUNCHER"
            onClick={() => navigate('/pea-launcher')}
            color={location.pathname === '/pea-launcher' ? 'primary' : 'default'}
            variant={location.pathname === '/pea-launcher' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip
            label="HEPTAPOD MESH"
            onClick={() => navigate('/heptapod-mesh')}
            color={location.pathname === '/heptapod-mesh' ? 'primary' : 'default'}
            variant={location.pathname === '/heptapod-mesh' ? 'filled' : 'outlined'}
            clickable
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<CircleIcon sx={{ fontSize: 12, color: zenohConnected ? 'success.main' : 'error.main' }} />}
            label="ZENOH CONNECTED"
            size="small"
            sx={{
              backgroundColor: 'background.default',
              color: 'text.primary',
              fontWeight: 600,
              opacity: zenohConnected ? 1 : 0.7
            }}
          />
          <Chip
            icon={<CircleIcon sx={{ fontSize: 12, color: evaIcsOnline ? 'success.main' : 'error.main' }} />}
            label="EVA-ICS ONLINE"
            size="small"
            sx={{
              backgroundColor: 'background.default',
              color: 'text.primary',
              fontWeight: 600,
              opacity: evaIcsOnline ? 1 : 0.7
            }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2 }}>
            {currentTime.toLocaleString()}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
