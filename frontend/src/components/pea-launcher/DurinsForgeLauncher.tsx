import React, { useState, useEffect, useCallback } from 'react'
import {
    Paper, Typography, Box, Button, Card, CardContent,
    CardActions, Chip, CircularProgress, Alert, Grid, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import {
    PlayArrow, Refresh, Info as InfoIcon,
    CheckCircle as SuccessIcon, ErrorOutline as ErrorIcon
} from '@mui/icons-material'
import axios from 'axios'

interface Scenario {
    id: string
    name: string
    spec: string
    priority: string
    tags: string[]
    duration_sim_min: number
    timeout_real_s: number
}

interface RunningScenario {
    run_id: string
    scenario_id: string
    started_at: string
    status: string
    progress_percent: number
    message: string
}

const DurinsForgeLauncher: React.FC = () => {
    const [scenarios, setScenarios] = useState<Scenario[]>([])
    const [runningScenarios, setRunningScenarios] = useState<RunningScenario[]>([])
    const [loading, setLoading] = useState(true)
    const [launchInProgress, setLaunchInProgress] = useState(false)
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
    const [putCommand, setPutCommand] = useState('')
    const [siteName, setSiteName] = useState('refinery_01')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

    // Load available scenarios
    const loadScenarios = useCallback(async () => {
        try {
            setLoading(true)
            console.log(`Fetching scenarios from: ${API_URL}/scenarios`)
            const response = await axios.get(`${API_URL}/scenarios`, { timeout: 5000 })
            console.log('Scenarios response:', response.data)
            setScenarios(response.data.scenarios || [])
            if (!response.data.scenarios || response.data.scenarios.length === 0) {
                setStatusMessage({
                    type: 'info',
                    text: 'No scenarios found. Ensure durins-forge is running.'
                })
            }
        } catch (error: any) {
            console.error('Failed to load scenarios:', error)
            console.error('Error response:', error.response?.data)
            console.error('Error status:', error.response?.status)
            setStatusMessage({
                type: 'error',
                text: `Failed to load scenarios: ${error.response?.status || error.message || 'Unknown error'}. Check that API is running at ${API_URL}`
            })
        } finally {
            setLoading(false)
        }
    }, [API_URL])

    // Load running scenarios
    const loadRunningScenarios = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/scenarios/running`)
            setRunningScenarios(response.data.running_scenarios || [])
        } catch (error) {
            console.error('Failed to load running scenarios:', error)
        }
    }, [API_URL])

    useEffect(() => {
        loadScenarios()
        loadRunningScenarios()

        // Poll for running scenarios updates
        const interval = setInterval(loadRunningScenarios, 5000)
        return () => clearInterval(interval)
    }, [loadScenarios, loadRunningScenarios])

    const handleLaunchClick = (scenario: Scenario) => {
        setSelectedScenario(scenario)
        setPutCommand('')
        setSiteName('refinery_01')
        setDialogOpen(true)
    }

    const handleLaunchConfirm = async () => {
        if (!selectedScenario) return

        try {
            setLaunchInProgress(true)
            const response = await axios.post(`${API_URL}/scenarios/launch`, {
                scenario_id: selectedScenario.id,
                put_cmd: putCommand || undefined,
                site: siteName || undefined,
            })

            setStatusMessage({
                type: 'success',
                text: `Launched scenario ${selectedScenario.id}. Run ID: ${response.data.run_id}`
            })

            setDialogOpen(false)
            setTimeout(loadRunningScenarios, 1000)
        } catch (error: any) {
            console.error('Failed to launch scenario:', error)
            setStatusMessage({
                type: 'error',
                text: `Failed to launch scenario: ${error.response?.data?.error || error.message}`
            })
        } finally {
            setLaunchInProgress(false)
        }
    }

    const getPriorityColor = (priority: string): 'success' | 'warning' | 'default' => {
        switch (priority) {
            case 'P1':
                return 'success'
            case 'P2':
                return 'warning'
            default:
                return 'default'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <SuccessIcon sx={{ color: 'success.main' }} />
            case 'failed':
                return <ErrorIcon sx={{ color: 'error.main' }} />
            default:
                return <CircularProgress size={20} />
        }
    }

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            padding: 2,
            overflow: 'auto'
        }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <div>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ⚒️ Durins-Forge Scenario Launcher
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Generate Factorio scenarios, deploy to the Zenoh bus, and monitor in real-time
                    </Typography>
                </div>
                <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadScenarios}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Status message */}
            {statusMessage && (
                <Alert
                    severity={statusMessage.type}
                    onClose={() => setStatusMessage(null)}
                    sx={{ mb: 2 }}
                >
                    {statusMessage.text}
                </Alert>
            )}

            {/* Running Scenarios */}
            {runningScenarios.length > 0 && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Active Scenarios ({runningScenarios.length})
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                    <TableCell>Run ID (first 8)</TableCell>
                                    <TableCell>Scenario</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Progress</TableCell>
                                    <TableCell>Message</TableCell>
                                    <TableCell>Started</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {runningScenarios.map((run) => (
                                    <TableRow key={run.run_id}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {run.run_id.substring(0, 8)}
                                        </TableCell>
                                        <TableCell>{run.scenario_id}</TableCell>
                                        <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getStatusIcon(run.status)}
                                            {run.status}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CircularProgress variant="determinate" value={run.progress_percent} size={20} />
                                                {run.progress_percent}%
                                            </Box>
                                        </TableCell>
                                        <TableCell>{run.message}</TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem' }}>
                                            {new Date(run.started_at).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Available Scenarios */}
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Available Scenarios {loading && <CircularProgress size={20} sx={{ ml: 2 }} />}
                </Typography>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : scenarios.length === 0 ? (
                    <Alert severity="info">
                        No scenarios found. Ensure durins-forge directory is accessible.
                    </Alert>
                ) : (
                    <Grid container spacing={2}>
                        {scenarios.map((scenario) => (
                            <Grid item xs={12} sm={6} md={4} key={scenario.id}>
                                <Card sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    '&:hover': {
                                        boxShadow: 3,
                                        transform: 'translateY(-2px)',
                                        transition: 'all 0.2s'
                                    }
                                }}>
                                    <CardContent sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                {scenario.id}
                                            </Typography>
                                            <Chip
                                                label={scenario.priority}
                                                size="small"
                                                color={getPriorityColor(scenario.priority)}
                                            />
                                        </Box>
                                        <Typography variant="body2" sx={{ mb: 2, color: 'textSecondary' }}>
                                            {scenario.name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                                            {scenario.tags.map((tag) => (
                                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                                            ))}
                                        </Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                                            ⏱️ {scenario.duration_sim_min} min sim / {scenario.timeout_real_s}s real
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }} component="span">
                                            📋 {scenario.spec}
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="primary"
                                            startIcon={<PlayArrow />}
                                            onClick={() => handleLaunchClick(scenario)}
                                            fullWidth
                                        >
                                            Launch
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Paper>

            {/* Launch Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Launch Scenario: {selectedScenario?.id}
                </DialogTitle>
                <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info" icon={<InfoIcon />}>
                        The Factorio world will be simulated headless and PEA telemetry will be published to the Zenoh bus for real-time monitoring.
                    </Alert>
                    <TextField
                        label="Zenoh Site Name"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        fullWidth
                        size="small"
                        helperText="Namespace for this scenario run"
                    />
                    <TextField
                        label="Product Under Test (PUT) Command"
                        value={putCommand}
                        onChange={(e) => setPutCommand(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        placeholder="e.g., cargo run --bin my_controller"
                        helperText="Optional. Leave empty for harness-only run, or 'none' to skip PUT."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleLaunchConfirm}
                        variant="contained"
                        startIcon={launchInProgress ? <CircularProgress size={20} /> : <PlayArrow />}
                        disabled={launchInProgress}
                    >
                        {launchInProgress ? 'Launching...' : 'Launch'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default DurinsForgeLauncher
