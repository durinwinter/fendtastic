import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Chip,
  Fade,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
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
  const [selectedScenarioId, setSelectedScenarioId] = useState('baseline_cycle')
  const [simScenarios, setSimScenarios] = useState<Array<{
    id: string
    name: string
    description: string
    duration_s: number
    tick_ms: number
    time_ratio: number
  }>>([])

  const checkSimStatus = useCallback(async () => {
    try {
      const status = await apiService.getSimulatorStatus()
      setSimRunning(status.running)
      if (status.running && status.scenario_id) {
        setSelectedScenarioId(status.scenario_id)
      }
    } catch { /* API not available */ }
  }, [])

  useEffect(() => { checkSimStatus() }, [checkSimStatus])

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const res = await apiService.getSimulatorScenarios()
        setSimScenarios(res.scenarios || [])
        if (res.scenarios?.length && !res.scenarios.some(s => s.id === selectedScenarioId)) {
          setSelectedScenarioId(res.scenarios[0].id)
        }
      } catch {
        // API may be unavailable in some local setups.
      }
    }
    loadScenarios()
  }, [selectedScenarioId])

  useEffect(() => {
    const interval = setInterval(checkSimStatus, 3000)
    return () => clearInterval(interval)
  }, [checkSimStatus])

  const toggleSimulator = async () => {
    setSimLoading(true)
    try {
      if (simRunning) {
        await apiService.stopSimulator()
        setSimRunning(false)
      } else {
        await apiService.startSimulator(selectedScenarioId)
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
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="scenario-select-label">Scenario</InputLabel>
          <Select
            labelId="scenario-select-label"
            value={selectedScenarioId}
            label="Scenario"
            onChange={(e) => setSelectedScenarioId(String(e.target.value))}
            disabled={simRunning || simLoading}
          >
            {(simScenarios.length > 0 ? simScenarios : [{ id: 'baseline_cycle', name: 'Baseline Work Cycle' }]).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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

          {/* Telemetry */}
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
