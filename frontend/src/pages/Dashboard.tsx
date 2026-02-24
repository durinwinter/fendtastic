import React, { useState, useEffect, useCallback } from 'react'
import { Box, Paper, Typography, CircularProgress, Button, Chip, Fade } from '@mui/material'
import { PlayArrow, Stop, Agriculture } from '@mui/icons-material'
import SwimlaneDiagram from '../components/SwimlaneDiagram'
import TimeSeriesChart from '../components/TimeSeriesChart'
import Header from '../components/Header'
import apiService from '../services/apiService'
import SpotValues from '../components/SpotValues'
import Coobie from '../components/Coobie'

// Lazy-load Three.js heavy component
const IsometricView = React.lazy(() => import('../components/IsometricView'))

const Dashboard: React.FC = () => {
  const [simRunning, setSimRunning] = useState(false)
  const [simLoading, setSimLoading] = useState(false)

  const checkSimStatus = useCallback(async () => {
    try {
      const status = await apiService.getSimulatorStatus()
      setSimRunning(status.running)
    } catch { /* API not available */ }
  }, [])

  useEffect(() => { checkSimStatus() }, [checkSimStatus])

  const toggleSimulator = async () => {
    setSimLoading(true)
    try {
      if (simRunning) {
        await apiService.stopSimulator()
        setSimRunning(false)
      } else {
        await apiService.startSimulator()
        setSimRunning(true)
      }
    } catch (e: any) {
      console.error('Simulator toggle failed:', e)
    } finally {
      setSimLoading(false)
    }
  }

  return (
    <Box sx={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.default',
      overflow: 'hidden',
      color: 'text.primary'
    }}>
      <Header />

      {/* Control Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 1,
        borderBottom: '1px solid #333',
        backgroundColor: '#0B0B0B'
      }}>
        <Agriculture sx={{ color: 'success.main', fontSize: 24 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: '0.05em' }}>
          FENdt Vario 1001
        </Typography>
        <Chip
          size="small"
          label={simRunning ? 'ONLINE' : 'OFFLINE'}
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 800,
            borderRadius: 1,
            backgroundColor: simRunning ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            color: simRunning ? 'success.main' : 'text.secondary',
            border: `1px solid ${simRunning ? '#2ECC71' : '#444'}`
          }}
        />
        <Button
          size="small"
          variant="contained"
          color={simRunning ? 'error' : 'success'}
          startIcon={simLoading ? <CircularProgress size={14} color="inherit" /> : simRunning ? <Stop /> : <PlayArrow />}
          onClick={toggleSimulator}
          disabled={simLoading}
          sx={{ ml: 'auto', px: 2, py: 0.5, borderRadius: 1 }}
        >
          {simRunning ? 'STOP SIM' : 'START SIM'}
        </Button>
      </Box>

      <Box sx={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Main Content (Left) */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          gap: 2,
          overflow: 'hidden'
        }}>
          {/* System Timeline */}
          <Paper sx={{ flex: '0 0 32%', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #2A2A2A' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em' }}>
                SYSTEM TIMELINE
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <SwimlaneDiagram />
            </Box>
          </Paper>

          {/* Telemetry */}
          <Paper sx={{ flex: '0 0 30%', p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em' }}>
                TELEMETRY
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {['1M', '5M', '15M', '1H', '6H', '24H'].map(t => (
                  <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: '0.6rem', borderRadius: 0.5, backgroundColor: t === '5M' ? 'primary.main' : 'transparent', border: '1px solid #444' }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden', p: 1 }}>
              <TimeSeriesChart />
            </Box>
          </Paper>

          {/* Machine View */}
          <Paper sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #2A2A2A' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '0.1em' }}>
                MACHINE VIEW
              </Typography>
            </Box>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <React.Suspense fallback={<Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>}>
                <IsometricView />
              </React.Suspense>
              {!simRunning && (
                <Fade in={!simRunning}>
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)'
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '0.1em', color: '#fff' }}>
                      SIMULATOR OFFLINE
                    </Typography>
                  </Box>
                </Fade>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Live Metrics Sidebar (Right) */}
        <Box sx={{
          width: 300,
          backgroundColor: '#0B0B0B',
          borderLeft: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          overflow: 'hidden'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'primary.main' }}>
              LIVE METRICS
            </Typography>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2ECC71', boxShadow: '0 0 8px #2ECC71' }} />
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
            <SpotValues />
          </Box>

          {/* Coobie Placement */}
          <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid #222' }}>
            <Coobie />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard
