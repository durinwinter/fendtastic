import React, { useState } from 'react'
import { Box, Tabs, Tab, Typography } from '@mui/material'
import Header from '../components/Header'
import NetworkOverview from '../components/mesh/NetworkOverview'
import NamespaceBrowser from '../components/mesh/NamespaceBrowser'
import NodeManager from '../components/mesh/NodeManager'
import RouterConfig from '../components/mesh/RouterConfig'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mesh-tabpanel-${index}`}
      aria-labelledby={`mesh-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'hidden' }}
    >
      {value === index && (
        <Box sx={{ p: 3, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const HeptapodMesh: React.FC = () => {
  const [tabValue, setTabValue] = useState(0)

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  return (
    <Box sx={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.default',
      overflow: 'hidden',
    }}>
      <Header />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
          <Typography variant="h5" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
            Heptapod Mesh — Zenoh Network Administration
          </Typography>
          <Tabs value={tabValue} onChange={handleChange} aria-label="mesh tabs">
            <Tab label="Network Overview" />
            <Tab label="Namespace Browser" />
            <Tab label="Node Manager" />
            <Tab label="Router Config" />
          </Tabs>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <CustomTabPanel value={tabValue} index={0}>
            <NetworkOverview />
          </CustomTabPanel>
          <CustomTabPanel value={tabValue} index={1}>
            <NamespaceBrowser />
          </CustomTabPanel>
          <CustomTabPanel value={tabValue} index={2}>
            <NodeManager />
          </CustomTabPanel>
          <CustomTabPanel value={tabValue} index={3}>
            <RouterConfig />
          </CustomTabPanel>
        </Box>
      </Box>
    </Box>
  )
}

export default HeptapodMesh
