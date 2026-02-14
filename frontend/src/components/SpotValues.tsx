import React from 'react'
import { Box, Paper, Typography, Divider } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'

interface SpotValue {
  label: string
  value: string | number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
}

const SpotValues: React.FC = () => {
  // Mock data - in production from Zenoh
  const spotValues: SpotValue[] = [
    { label: 'Engine Temp', value: 72.5, unit: '°C', status: 'normal', trend: 'stable' },
    { label: 'Oil Pressure', value: 1050, unit: 'PSI', status: 'normal', trend: 'up' },
    { label: 'RPM', value: 2800, unit: 'rpm', status: 'normal', trend: 'stable' },
    { label: 'Fuel Level', value: 67, unit: '%', status: 'normal', trend: 'down' },
    { label: 'Hydraulic Temp', value: 85.2, unit: '°C', status: 'warning', trend: 'up' },
    { label: 'Battery Voltage', value: 13.8, unit: 'V', status: 'normal', trend: 'stable' },
    { label: 'Coolant Level', value: 92, unit: '%', status: 'normal', trend: 'stable' },
    { label: 'Vibration', value: 48, unit: 'Hz', status: 'normal', trend: 'stable' },
  ]

  const getStatusColor = (status: SpotValue['status']) => {
    switch (status) {
      case 'critical': return '#E74C3C'
      case 'warning': return '#F39C12'
      default: return '#6EC72D'
    }
  }

  return (
    <Paper sx={{
      height: '100%',
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Typography
        variant="h6"
        sx={{
          mb: 2,
          color: 'primary.main',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}
      >
        LIVE METRICS
      </Typography>

      <Box sx={{
        flex: 1,
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'primary.dark',
          borderRadius: '3px',
        },
      }}>
        {spotValues.map((item, index) => (
          <React.Fragment key={item.label}>
            <Box sx={{
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5
            }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em'
                }}
              >
                {item.label}
              </Typography>

              <Box sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      color: getStatusColor(item.status),
                      fontWeight: 700,
                      fontSize: '1.5rem',
                      lineHeight: 1
                    }}
                  >
                    {item.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem'
                    }}
                  >
                    {item.unit}
                  </Typography>
                </Box>

                {item.trend && item.trend !== 'stable' && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {item.trend === 'up' ? (
                      <TrendingUp sx={{ fontSize: 16, color: '#E67E22' }} />
                    ) : (
                      <TrendingDown sx={{ fontSize: 16, color: '#3498DB' }} />
                    )}
                  </Box>
                )}
              </Box>

              {/* Status indicator bar */}
              <Box sx={{
                width: '100%',
                height: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1,
                overflow: 'hidden',
                mt: 0.5
              }}>
                <Box sx={{
                  width: item.status === 'critical' ? '100%' :
                         item.status === 'warning' ? '70%' : '100%',
                  height: '100%',
                  backgroundColor: getStatusColor(item.status),
                  transition: 'all 0.3s'
                }} />
              </Box>
            </Box>

            {index < spotValues.length - 1 && (
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Paper>
  )
}

export default SpotValues
