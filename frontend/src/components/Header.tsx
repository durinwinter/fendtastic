import React, { useEffect, useState } from 'react'
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material'
import { Circle as CircleIcon } from '@mui/icons-material'
import zenohService from '../services/zenohService'
import { useNavigate, useLocation } from 'react-router-dom'
import { styled } from '@mui/material/styles'
import entWorkshopBadge from '../../ent_workshop_badge.png'

const barkLinework = 'var(--ent-linework-soft), var(--ent-linework)'
const trunkRibbon = 'var(--ent-trunk-ribbon)'

const NavChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'data-active',
})<{ 'data-active'?: boolean }>(({ theme, 'data-active': active }) => ({
  height: 42,
  borderRadius: '18px 14px 20px 14px',
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '0 10px',
  color: theme.palette.text.primary,
  border: `1px solid ${active ? 'rgba(240,195,106,0.32)' : 'rgba(240,195,106,0.14)'}`,
  backgroundImage: `radial-gradient(circle at 14% 12%, ${active ? 'rgba(110,139,74,0.16)' : 'rgba(110,139,74,0.08)'}, transparent 20%), ${trunkRibbon}, linear-gradient(180deg, ${active ? 'rgba(127,86,51,0.96), rgba(81,52,31,0.98)' : 'rgba(51,36,25,0.98), rgba(26,18,13,0.98)'}), ${barkLinework}`,
  backgroundSize: 'auto, auto, auto, 240px 90px, 240px 90px',
  boxShadow: active
    ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(240,195,106,0.14), 0 10px 24px rgba(0,0,0,0.26), 0 0 20px rgba(240,195,106,0.08), 0 0 28px rgba(110,139,74,0.06)'
    : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -12px 18px rgba(45,29,18,0.28), 0 8px 18px rgba(0,0,0,0.16)',
  '&:hover': {
    filter: 'brightness(1.05)',
  },
  '& .MuiChip-label': {
    paddingLeft: 14,
    paddingRight: 14,
  },
}))

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'data-status',
})<{ 'data-status'?: 'success' | 'error' }>(({ 'data-status': status }) => ({
  height: 28,
  borderRadius: 999,
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  border: `1px solid ${status === 'success' ? 'rgba(110,139,74,0.38)' : 'rgba(195,98,61,0.38)'}`,
  backgroundImage: `radial-gradient(circle at 14% 12%, ${status === 'success' ? 'rgba(110,139,74,0.14)' : 'rgba(195,98,61,0.1)'}, transparent 20%), ${trunkRibbon}, linear-gradient(180deg, rgba(49,33,22,0.92), rgba(18,12,9,0.96)), ${barkLinework}`,
  backgroundSize: 'auto, auto, auto, 240px 90px, 240px 90px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 18px rgba(0,0,0,0.18)',
  color: '#f5e9cf',
  '& .MuiChip-icon': {
    color: status === 'success' ? '#6e8b4a' : '#c3623d',
    fontSize: 11,
    marginLeft: 8,
  },
}))

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
    const unsubscribeRuntime = zenohService.subscribe('murph/status/runtime-orchestrator', (data) => {
      setRuntimeOrchestratorOnline(!!(data && data.online))
    })
    return () => {
      clearInterval(timer)
      unsubscribeZenoh()
      unsubscribeRuntime()
    }
  }, [])

  return (
    <AppBar
      position="static"
      sx={{
        height: 78,
        justifyContent: 'center',
        px: 1,
        backgroundImage:
          'radial-gradient(circle at 8% 6%, rgba(110,139,74,0.14), transparent 14%), radial-gradient(circle at 92% 0%, rgba(110,139,74,0.1), transparent 12%), linear-gradient(180deg, rgba(39,26,18,0.96), rgba(13,9,7,0.98)), var(--ent-linework-soft), var(--ent-linework)',
        backgroundSize: 'auto, auto, auto, 320px 120px, 320px 120px',
      }}
    >
      <Toolbar sx={{ px: 2.5, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            gap: 1.8,
            minWidth: 0,
          }}
          onClick={() => navigate('/')}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid rgba(240,195,106,0.24)',
              backgroundImage: 'radial-gradient(circle at center, rgba(240,195,106,0.14), transparent 58%), linear-gradient(180deg, rgba(38,25,17,0.98), rgba(11,8,6,0.98))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 24px rgba(0,0,0,0.22), 0 0 24px rgba(240,195,106,0.08)',
            }}
          >
            <Box
              component="img"
              src={entWorkshopBadge}
              alt="Ent Workshop badge"
              sx={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                mb: 0.3,
              }}
            >
              Ent Workshop
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: 'secondary.light',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              MURPH Runtime Forge
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { path: '/', label: 'Dashboard' },
            { path: '/heptapod', label: 'Process Monitor' },
            { path: '/pea-launcher', label: 'Runtime Studio' },
            { path: '/heptapod-mesh', label: 'Mesh Control' },
            { path: '/mars-habitat', label: 'Mars Habitat' },
          ].map((item) => (
            <NavChip
              key={item.path}
              label={item.label}
              clickable
              data-active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
              ml: 0.6,
              fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
