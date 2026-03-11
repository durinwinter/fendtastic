import React, { useEffect, useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { Circle as CircleIcon } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import zenohService from '../services/zenohService'

const barkLinework = 'var(--ent-linework-soft), var(--ent-linework)'
const trunkRibbon = 'var(--ent-trunk-ribbon)'

const NavChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'data-active',
})<{ 'data-active'?: boolean }>(({ theme, 'data-active': active }) => ({
  height: 32,
  borderRadius: 16,
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: '0.03em',
  padding: '0 4px',
  color: theme.palette.text.primary,
  border: `1px solid ${active ? 'rgba(240,195,106,0.34)' : 'rgba(240,195,106,0.12)'}`,
  backgroundImage: `radial-gradient(circle at 14% 12%, ${active ? 'rgba(110,139,74,0.14)' : 'rgba(110,139,74,0.07)'}, transparent 20%), ${trunkRibbon}, linear-gradient(180deg, ${active ? 'rgba(127,86,51,0.96), rgba(81,52,31,0.98)' : 'rgba(51,36,25,0.92), rgba(26,18,13,0.96)'}), ${barkLinework}`,
  backgroundSize: 'auto, auto, auto, 240px 90px, 240px 90px',
  boxShadow: active
    ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(240,195,106,0.12), 0 8px 18px rgba(0,0,0,0.22)'
    : 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -10px 14px rgba(45,29,18,0.26), 0 6px 14px rgba(0,0,0,0.16)',
  '&:hover': {
    filter: 'brightness(1.05)',
  },
  '& .MuiChip-label': {
    paddingLeft: 8,
    paddingRight: 8,
  },
}))

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'data-status',
})<{ 'data-status'?: 'success' | 'error' }>(({ 'data-status': status }) => ({
  height: 24,
  borderRadius: 999,
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  border: `1px solid ${status === 'success' ? 'rgba(110,139,74,0.32)' : 'rgba(195,98,61,0.36)'}`,
  backgroundImage: `radial-gradient(circle at 14% 12%, ${status === 'success' ? 'rgba(110,139,74,0.12)' : 'rgba(195,98,61,0.08)'}, transparent 20%), ${trunkRibbon}, linear-gradient(180deg, rgba(49,33,22,0.9), rgba(18,12,9,0.94)), ${barkLinework}`,
  backgroundSize: 'auto, auto, auto, 240px 90px, 240px 90px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 14px rgba(0,0,0,0.16)',
  color: '#f5e9cf',
  '& .MuiChip-icon': {
    color: status === 'success' ? '#6e8b4a' : '#c3623d',
    fontSize: 10,
    marginLeft: 8,
  },
  '& .MuiChip-label': {
    paddingLeft: 6,
    paddingRight: 8,
  },
}))

const routes = [
  { path: '/', label: 'Dashboard' },
  { path: '/pea-launcher', label: 'Runtime Studio' },
  { path: '/heptapod', label: 'Process Monitor' },
  { path: '/heptapod-mesh', label: 'Mesh Control' },
  { path: '/mars-habitat', label: 'Mars Habitat' },
]

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [zenohConnected, setZenohConnected] = useState(false)
  const [runtimeOrchestratorOnline, setRuntimeOrchestratorOnline] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    const unsubscribeZenoh = zenohService.onConnectionChange((connected) => {
      setZenohConnected(connected)
      if (!connected) setRuntimeOrchestratorOnline(false)
    })
    const unsubscribeRuntime = zenohService.subscribe('entmoot/status/runtime-orchestrator', (data) => {
      setRuntimeOrchestratorOnline(!!(data && data.online))
    })

    return () => {
      clearInterval(timer)
      unsubscribeZenoh()
      unsubscribeRuntime()
    }
  }, [])

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.55, flexWrap: 'wrap', maxWidth: '61%' }}>
        {routes.map((item) => (
          <NavChip
            key={item.path}
            label={item.label}
            clickable
            data-active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.55, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: '37%' }}>
        <StatusChip
          icon={<CircleIcon />}
          label={zenohConnected ? 'Zenoh Connected' : 'Zenoh Offline'}
          data-status={zenohConnected ? 'success' : 'error'}
        />
        <StatusChip
          icon={<CircleIcon />}
          label={runtimeOrchestratorOnline ? 'Orchestrator Online' : 'Orchestrator Offline'}
          data-status={runtimeOrchestratorOnline ? 'success' : 'error'}
        />
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            ml: 0.4,
            fontSize: '0.62rem',
            fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
            letterSpacing: '0.03em',
          }}
        >
          {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Box>
  )
}

export default Header
