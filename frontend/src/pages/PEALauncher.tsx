import React, { useState } from 'react'
import { Box, Tabs, Tab, Typography } from '@mui/material'
import Header from '../components/Header'
import EngineeringView from '../components/pea-launcher/EngineeringView'
import RuntimeControl from '../components/pea-launcher/RuntimeControl'
import SettingsView from '../components/pea-launcher/SettingsView'
import DurinsForgeLauncher from '../components/pea-launcher/DurinsForgeLauncher'
import Coobie from '../components/Coobie'

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
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
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

const PEALauncher: React.FC = () => {
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
            overflow: 'hidden'
        }}>
            <Header />

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
                    <Typography variant="h5" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                        PEA Launcher App
                    </Typography>
                    <Tabs value={tabValue} onChange={handleChange} aria-label="pea launcher tabs">
                        <Tab label="Durins-Forge Launcher" />
                        <Tab label="Engineering MTP" />
                        <Tab label="Runtime Control" />
                        <Tab label="Settings" />
                    </Tabs>
                </Box>

                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <CustomTabPanel value={tabValue} index={0}>
                        <DurinsForgeLauncher />
                    </CustomTabPanel>
                    <CustomTabPanel value={tabValue} index={1}>
                        <EngineeringView />
                    </CustomTabPanel>
                    <CustomTabPanel value={tabValue} index={2}>
                        <RuntimeControl />
                    </CustomTabPanel>
                    <CustomTabPanel value={tabValue} index={3}>
                        <SettingsView />
                    </CustomTabPanel>
                </Box>
            </Box>
            <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
                <Coobie />
            </Box>
        </Box>
    )
}

export default PEALauncher
