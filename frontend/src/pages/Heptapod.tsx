import React from 'react'
import { Alert, Box, Grid, Paper, Typography, Tabs, Tab } from '@mui/material'
import PEAList from '../components/heptapod/PEAList'
import RecipeManager from '../components/heptapod/RecipeManager'
import AlarmCenter from '../components/heptapod/AlarmCenter'
import PeaConnectionsDesigner from '../components/heptapod/PeaConnectionsDesigner'
import Coobie from '../components/Coobie'
import EntShellScaffold from '../components/layout/EntShellScaffold'

const Heptapod: React.FC = () => {
    const [tab, setTab] = React.useState(0)

    return (
        <EntShellScaffold contentSx={{ overflow: 'auto' }}>
            <Box sx={{ height: '100%', overflow: 'auto', pr: 1 }}>
                <Typography variant="h4" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}>
                    Entmoot Habitat Orchestration
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
                    <Box sx={{ height: 'calc(100% - 110px)', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 3 }}>
                        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                Habitat Overview
                            </Typography>
                            <Alert severity="info">
                                3D habitat visualization is disabled in this build.
                            </Alert>
                            <Typography variant="body2" color="text.secondary">
                                Use orchestration, alarm, and connection views as the active operational surfaces while the runtime refactor stabilizes.
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Primary Surface</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700 }}>PEA Orchestration</Typography>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Fallback Surface</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700 }}>PEA Connections</Typography>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Alarm Surface</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700 }}>Alarm Center</Typography>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Focus</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700 }}>Runtime + Authority Refactor</Typography>
                                </Paper>
                            </Box>
                        </Paper>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                                Current Guidance
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Keep topology work in the connection designer and validate node/driver health in Runtime Studio. Reintroduce spatial views only after the runtime and authority model are stable.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                This removes the heavy `three` dependency path from the active frontend bundle.
                            </Typography>
                        </Paper>
                    </Box>
                )}
                {tab === 3 && (
                    <Box sx={{ height: 'calc(100% - 110px)' }}>
                        <PeaConnectionsDesigner />
                    </Box>
                )}
            </Box>
            <Box sx={{ position: 'absolute', bottom: 12, right: 12, zIndex: 7 }}>
                <Coobie />
            </Box>
        </EntShellScaffold>
    )
}

export default Heptapod
