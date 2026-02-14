import React from 'react'
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material'
import { Circle as CircleIcon } from '@mui/icons-material'

const Header: React.FC = () => {
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
            flexGrow: 1,
            fontWeight: 700,
            color: 'primary.main',
            letterSpacing: '0.05em'
          }}
        >
          FENDTASTIC CONTROL SYSTEM
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<CircleIcon sx={{ fontSize: 12, color: 'success.main' }} />}
            label="ZENOH CONNECTED"
            size="small"
            sx={{
              backgroundColor: 'background.default',
              color: 'text.primary',
              fontWeight: 600
            }}
          />
          <Chip
            icon={<CircleIcon sx={{ fontSize: 12, color: 'success.main' }} />}
            label="EVA-ICS ONLINE"
            size="small"
            sx={{
              backgroundColor: 'background.default',
              color: 'text.primary',
              fontWeight: 600
            }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2 }}>
            {new Date().toLocaleString()}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
