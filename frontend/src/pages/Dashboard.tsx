import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { Agriculture } from '@mui/icons-material'
import SwimlaneDiagram from '../components/SwimlaneDiagram'
import TimeSeriesChart from '../components/TimeSeriesChart'
import SpotValues from '../components/SpotValues'
import Coobie from '../components/Coobie'
import zenohService from '../services/zenohService'
import EntShellScaffold from '../components/layout/EntShellScaffold'

type LivePea = {
  id: string
  nodeId: string
  name: string
  deployed: boolean
  running: boolean
  serviceCount: number
  lastSeen: number
}

function parsePeaKey(key: string): { nodeId: string; peaId: string } | null {
  const parts = key.split('/')
  const nodeIndex = parts.indexOf('nodes')
  const peaIndex = parts.indexOf('pea')
  if (nodeIndex < 0 || peaIndex < 0 || nodeIndex >= parts.length - 1 || peaIndex >= parts.length - 1) {
    return null
  }
  return {
    nodeId: parts[nodeIndex + 1],
    peaId: parts[peaIndex + 1],
  }
}

const Dashboard: React.FC = () => {
  const [peas, setPeas] = useState<Record<string, LivePea>>({})
  const [selectedPeaId, setSelectedPeaId] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())
  const [zenohConnected, setZenohConnected] = useState(zenohService.isConnected)

  useEffect(() => {
    const unsubConnection = zenohService.onConnectionChange(setZenohConnected)

    const upsertPea = (payload: any) => {
      const key = typeof payload?._key === 'string' ? payload._key : ''
      const ids = parsePeaKey(key)
      if (!ids) return
      setPeas((current) => {
        const next = {
          ...current,
          [ids.peaId]: {
            id: ids.peaId,
            nodeId: ids.nodeId,
            name: typeof payload?.name === 'string' ? payload.name : current[ids.peaId]?.name || ids.peaId,
            deployed: payload?.deployed === true || current[ids.peaId]?.deployed === true,
            running: payload?.running === true,
            serviceCount: Array.isArray(payload?.services) ? payload.services.length : current[ids.peaId]?.serviceCount || 0,
            lastSeen: Date.now(),
          },
        }
        if (!selectedPeaId) {
          setSelectedPeaId(ids.peaId)
        }
        return next
      })
    }

    const unsubStatus = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/status', upsertPea)
    const unsubConfig = zenohService.subscribe('entmoot/habitat/nodes/+/pea/+/config', upsertPea)
    const clock = setInterval(() => setNowMs(Date.now()), 5000)

    return () => {
      unsubConnection()
      unsubStatus()
      unsubConfig()
      clearInterval(clock)
    }
  }, [selectedPeaId])

  const peaList = useMemo(() => Object.values(peas).sort((a, b) => b.lastSeen - a.lastSeen), [peas])
  const activePea = selectedPeaId ? peas[selectedPeaId] : peaList[0]
  const activeOnline = activePea ? nowMs - activePea.lastSeen < 15_000 : false

  return (
    <EntShellScaffold>
      <Box sx={{ height: '100%', display: 'flex', gap: 2, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <Paper
            sx={{
              flex: '0 0 auto',
              px: 2.5,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Agriculture sx={{ color: 'success.main', fontSize: 24 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: '0.05em', color: 'secondary.light' }}>
              {activePea?.name || 'No live PEA context'}
            </Typography>
            <Chip
              size="small"
              label={activeOnline ? 'ONLINE' : 'AWAITING BUS'}
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 800,
                backgroundColor: activeOnline ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: activeOnline ? 'success.main' : 'text.secondary',
                border: `1px solid ${activeOnline ? '#2ECC71' : '#444'}`,
              }}
            />
            <Chip
              size="small"
              label={zenohConnected ? 'ZENOH BUS CONNECTED' : 'ZENOH BUS OFFLINE'}
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 800,
                backgroundColor: zenohConnected ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: zenohConnected ? 'success.main' : 'text.secondary',
                border: `1px solid ${zenohConnected ? '#2ECC71' : '#444'}`,
              }}
            />
            <Chip size="small" label={`${peaList.length} PEAs discovered`} sx={{ height: 22, fontSize: '0.65rem', fontWeight: 800 }} />
            <FormControl size="small" sx={{ minWidth: 240, ml: 'auto' }}>
              <InputLabel id="pea-select-label">Active PEA</InputLabel>
              <Select
                labelId="pea-select-label"
                value={activePea?.id || ''}
                label="Active PEA"
                onChange={(e) => setSelectedPeaId(String(e.target.value))}
              >
                {peaList.map((pea) => (
                  <MenuItem key={pea.id} value={pea.id}>
                    {pea.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <Paper sx={{ flex: '0 0 auto', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 0.5, borderBottom: '1px solid #2A2A2A', display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em', fontSize: '0.65rem' }}>
                SYSTEM TIMELINE
              </Typography>
            </Box>
            <Box sx={{ height: 120, overflow: 'hidden' }}>
              <SwimlaneDiagram />
            </Box>
          </Paper>

          <Paper sx={{ flex: '1 1 35%', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 0.5, borderBottom: '1px solid #2A2A2A' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em', fontSize: '0.65rem' }}>
                TELEMETRY
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden', p: 1 }}>
              <TimeSeriesChart />
            </Box>
          </Paper>

          <Paper sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #2A2A2A' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em' }}>
                MACHINE SNAPSHOT
              </Typography>
            </Box>
            <Box sx={{ flex: 1, position: 'relative', p: 2, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#2A2A2A' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, letterSpacing: '0.08em' }}>
                  Runtime Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Asset</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{activePea?.name || 'No live PEA'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">State</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: activeOnline ? 'success.main' : 'warning.main' }}>
                      {activePea?.running ? 'Executing' : activePea?.deployed ? 'Deployed' : activeOnline ? 'Observed' : 'Awaiting data'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Node</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{activePea?.nodeId || '--'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Services</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{activePea?.serviceCount ?? 0}</Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Dashboard state is sourced from live `entmoot` PEA traffic. Historical trends remain backed by the Zenoh-fed time-series store.
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#2A2A2A' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, letterSpacing: '0.08em' }}>
                  Operator Checklist
                </Typography>
                <List dense sx={{ p: 0 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText primary="Verify Zenoh bus connectivity" secondary={zenohConnected ? 'WebSocket relay is connected to the live substrate.' : 'Frontend is not currently receiving bus updates.'} />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText primary="Confirm active PEA heartbeat" secondary={activeOnline ? `Last status seen for ${activePea?.id ?? 'selected PEA'} within the live window.` : 'No recent status frame for the selected PEA yet.'} />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText primary="Review telemetry and alarms" secondary="Trend panels remain useful only when backed by live entmoot traffic." />
                  </ListItem>
                </List>
              </Paper>
            </Box>
          </Paper>
            </Box>

            <Paper
              sx={{
                width: 300,
                display: 'flex',
                flexDirection: 'column',
                p: 2,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'primary.main' }}>
                  LIVE METRICS
                </Typography>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: zenohConnected ? '#2ECC71' : '#555', boxShadow: zenohConnected ? '0 0 8px #2ECC71' : 'none' }} />
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
                <SpotValues />
              </Box>

              <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid #222' }}>
                <Coobie />
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </EntShellScaffold>
  )
}

export default Dashboard
