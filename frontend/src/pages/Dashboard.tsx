import React from 'react'
import { Box, Grid, Paper, Typography } from '@mui/material'
import SwimlaneDiagram from '../components/SwimlaneDiagram'
import TimeSeriesChart from '../components/TimeSeriesChart'
import SpotValues from '../components/SpotValues'
import IsometricView from '../components/IsometricView'
import Header from '../components/Header'

const Dashboard: React.FC = () => {
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
              <IsometricView />
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
