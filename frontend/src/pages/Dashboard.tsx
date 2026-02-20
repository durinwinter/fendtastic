import React, { Suspense, useState, useEffect, useCallback } from 'react'
import { Box, Paper, Typography, CircularProgress, Button, Chip } from '@mui/material'
import { PlayArrow, Stop, Agriculture } from '@mui/icons-material'
import SwimlaneDiagram from '../components/SwimlaneDiagram'
import TimeSeriesChart from '../components/TimeSeriesChart'
import SpotValues from '../components/SpotValues'
import Header from '../components/Header'
import apiService from '../services/apiService'

// Lazy-load Three.js heavy component to avoid blocking initial render
const IsometricView = React.lazy(() => import('../components/IsometricView'))

const Dashboard: React.FC = () => {
  const [simRunning, setSimRunning] = useState(false)
  const [simLoading, setSimLoading] = useState(false)

  const checkSimStatus = useCallback(async () => {
    try {
      const status = await apiService.getSimulatorStatus()
      setSimRunning(status.running)
    } catch {
      // API not available yet
    }
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
      // The global interceptor will handle the network error, 
      // but we can add specific logic here if needed.
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
      overflow: 'hidden'
    }}>
      <Header />

      {/* Simulator control bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        pt: 1,
      }}>
        <Agriculture sx={{ color: 'success.main', fontSize: 28 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Fendt Vario 1001
        </Typography>
        <Chip
          size="small"
          label={simRunning ? 'SIMULATING' : 'OFFLINE'}
          color={simRunning ? 'success' : 'default'}
          variant={simRunning ? 'filled' : 'outlined'}
          sx={{ fontSize: '0.7rem' }}
        />
        <Button
          size="small"
          variant={simRunning ? 'outlined' : 'contained'}
          color={simRunning ? 'error' : 'success'}
          startIcon={simLoading ? <CircularProgress size={14} color="inherit" /> : simRunning ? <Stop /> : <PlayArrow />}
          onClick={toggleSimulator}
          disabled={simLoading}
          sx={{ ml: 'auto', minWidth: 120 }}
        >
          {simRunning ? 'Stop Sim' : 'Start Sim'}
        </Button>
      </Box>

      <Box sx={{
        flex: 1,
        display: 'flex',
        gap: 2,
        p: 2,
        overflow: 'hidden'
      }}>
        {/* Main content area */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0
        }}>
          {/* Swimlane Diagram */}
          <Paper sx={{
            flex: '0 0 35%',
            p: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              System Timeline
            </Typography>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <SwimlaneDiagram />
            </Box>
          </Paper>

          {/* Time Series Chart */}
          <Paper sx={{
            flex: '0 0 30%',
            p: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Telemetry
            </Typography>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <TimeSeriesChart />
            </Box>
          </Paper>

          {/* Isometric View */}
          <Paper sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Machine View
            </Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <Suspense fallback={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <CircularProgress color="primary" size={32} />
                </Box>
              }>
                <IsometricView />
              </Suspense>
              {!simRunning && (
                <Box sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  borderRadius: 1
                }}>
                  <Typography variant="h6" color="white" sx={{ fontWeight: 'bold' }}>
                    SIMULATOR OFFLINE
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Right sidebar - Spot Values */}
        <Box sx={{
          width: '280px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <SpotValues />
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard
