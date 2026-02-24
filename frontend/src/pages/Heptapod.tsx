import React from 'react'
import { Box, Grid, Typography, Tabs, Tab } from '@mui/material'
import Header from '../components/Header'
import PEAList from '../components/heptapod/PEAList'
import RecipeManager from '../components/heptapod/RecipeManager'
import AlarmCenter from '../components/heptapod/AlarmCenter'
import IsometricWorkbench from '../components/heptapod/IsometricWorkbench'
import PeaConnectionsDesigner from '../components/heptapod/PeaConnectionsDesigner'
import Coobie from '../components/Coobie'

const Heptapod: React.FC = () => {
    const [tab, setTab] = React.useState(0)

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

            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                <Typography variant="h4" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}>
                    MURPH Habitat Orchestration
                </Typography>

                <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
                    <Tab label="Orchestration" />
                    <Tab label="Alarm Center" />
                    <Tab label="Habitat Overview" />
                    <Tab label="PEA Connections" />
                </Tabs>

                {tab === 0 && (
                    <Grid container spacing={3} sx={{ height: 'calc(100% - 110px)' }}>
                        <Grid item xs={12} md={8}>
                            <PEAList />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <RecipeManager />
                        </Grid>
                    </Grid>
                )}
                {tab === 1 && (
                    <Box sx={{ height: 'calc(100% - 110px)' }}>
                        <AlarmCenter />
                    </Box>
                )}
                {tab === 2 && (
                    <Box sx={{ height: 'calc(100% - 110px)' }}>
                        <IsometricWorkbench />
                    </Box>
                )}
                {tab === 3 && (
                    <Box sx={{ height: 'calc(100% - 110px)' }}>
                        <PeaConnectionsDesigner />
                    </Box>
                )}
            </Box>
            <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
                <Coobie />
            </Box>
        </Box>
    )
}

export default Heptapod
