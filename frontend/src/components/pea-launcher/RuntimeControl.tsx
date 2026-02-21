import React, { useState, useEffect, useCallback } from 'react'
import {
    Paper, Typography, Box, Button, Chip, Grid, Card, CardContent,
    CardActions, IconButton, Tooltip, LinearProgress, Alert, Select, MenuItem
} from '@mui/material'
import {
    PlayArrow, Stop, CloudUpload, Refresh,
    Circle as CircleIcon
} from '@mui/icons-material'
import zenohService from '../../services/zenohService'
import apiService from '../../services/apiService'
import { PeaConfig, ServiceState, ServiceCommand, ALLOWED_COMMANDS, getStateColor, ZENOH_TOPICS } from '../../types/mtp'

interface PeaRuntime {
    config: PeaConfig
    deployed: boolean
    running: boolean
    services: {
        tag: string
        state: ServiceState
        currentProcedureId?: number
    }[]
    opcuaEndpoint?: string
}

const RuntimeControl: React.FC = () => {
    const [peas, setPeas] = useState<PeaRuntime[]>([])
    const [loading, setLoading] = useState(true)
    const [actionInProgress, setActionInProgress] = useState<string | null>(null)
    const [serviceCmdSelections, setServiceCmdSelections] = useState<Record<string, { command: ServiceCommand; procedureId?: number }>>({})

    const loadPeas = useCallback(async () => {
        try {
            const configs = await apiService.listPeas()
            setPeas(configs.map(config => ({
                config,
                deployed: false,
                running: false,
                services: config.services.map(s => ({
                    tag: s.tag,
                    state: ServiceState.Idle,
                })),
            })))
        } catch (e) {
            console.error('Failed to load PEAs:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadPeas() }, [loadPeas])

    // Subscribe to PEA status updates via Zenoh
    useEffect(() => {
        const unsubscribe = zenohService.subscribe(
            ZENOH_TOPICS.peaStatusWildcard,
            (data: any) => {
                if (!data || !data.pea_id) return
                setPeas(prev => prev.map(pea => {
                    if (pea.config.id !== data.pea_id) return pea
                    return {
                        ...pea,
                        deployed: data.deployed ?? pea.deployed,
                        running: data.running ?? pea.running,
                        opcuaEndpoint: data.opcua_endpoint ?? pea.opcuaEndpoint,
                        services: data.services?.map((s: any) => ({
                            tag: s.tag,
                            state: s.state as ServiceState,
                            currentProcedureId: s.current_procedure_id,
                        })) ?? pea.services,
                    }
                }))
            }
        )
        return () => unsubscribe()
    }, [])

    const handleDeploy = async (peaId: string) => {
        setActionInProgress(peaId)
        try {
            await apiService.deployPea(peaId)
            setPeas(prev => prev.map(p =>
                p.config.id === peaId ? { ...p, deployed: true } : p
            ))
        } catch (e) {
            console.error('Deploy failed:', e)
        } finally {
            setActionInProgress(null)
        }
    }

    const handleStart = async (peaId: string) => {
        setActionInProgress(peaId)
        try { await apiService.startPea(peaId) }
        catch (e) { console.error('Start failed:', e) }
        finally { setActionInProgress(null) }
    }

    const handleStop = async (peaId: string) => {
        setActionInProgress(peaId)
        try { await apiService.stopPea(peaId) }
        catch (e) { console.error('Stop failed:', e) }
        finally { setActionInProgress(null) }
    }

    const handleUndeploy = async (peaId: string) => {
        setActionInProgress(peaId)
        try { await apiService.undeployPea(peaId) }
        catch (e) { console.error('Undeploy failed:', e) }
        finally { setActionInProgress(null) }
    }

    const handleServiceCommand = async (peaId: string, serviceTag: string) => {
        const key = `${peaId}:${serviceTag}`
        const selection = serviceCmdSelections[key] ?? { command: ServiceCommand.Start }
        try {
            await apiService.commandService(peaId, serviceTag, selection.command, selection.procedureId)
        } catch (e) {
            console.error('Service command failed:', e)
        }
    }

    if (loading) {
        return (
            <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Runtime Control</Typography>
                <LinearProgress />
            </Paper>
        )
    }

    if (peas.length === 0) {
        return (
            <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Runtime Control</Typography>
                <Alert severity="info" sx={{ mt: 2 }}>
                    No PEA configurations found. Create one in the Engineering View first.
                </Alert>
            </Paper>
        )
    }

    return (
        <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Runtime Control</Typography>
                <Tooltip title="Refresh">
                    <IconButton onClick={loadPeas} size="small"><Refresh /></IconButton>
                </Tooltip>
            </Box>

            <Grid container spacing={2}>
                {peas.map(pea => (
                    <Grid item xs={12} md={6} lg={4} key={pea.config.id}>
                        <Card variant="outlined" sx={{
                            borderColor: pea.running ? 'success.main' : pea.deployed ? 'warning.main' : 'divider',
                            borderWidth: pea.running ? 2 : 1,
                        }}>
                            {actionInProgress === pea.config.id && <LinearProgress />}
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {pea.config.name || pea.config.id}
                                    </Typography>
                                    <Chip
                                        size="small"
                                        icon={<CircleIcon sx={{ fontSize: 10 }} />}
                                        label={pea.running ? 'RUNNING' : pea.deployed ? 'DEPLOYED' : 'OFFLINE'}
                                        color={pea.running ? 'success' : pea.deployed ? 'warning' : 'default'}
                                        variant={pea.running ? 'filled' : 'outlined'}
                                    />
                                </Box>

                                <Typography variant="caption" color="text.secondary" display="block">
                                    ID: {pea.config.id}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    v{pea.config.version}
                                </Typography>

                                {pea.opcuaEndpoint && (
                                    <Typography variant="caption" color="info.main" display="block" sx={{ mt: 0.5 }}>
                                        OPC UA: {pea.opcuaEndpoint}
                                    </Typography>
                                )}

                                {pea.services.length > 0 && (
                                    <Box sx={{ mt: 1.5 }}>
                                        <Typography variant="caption" fontWeight="bold">Services:</Typography>
                                        {pea.services.map(svc => (
                                            (() => {
                                                const allowed = ALLOWED_COMMANDS[svc.state] ?? []
                                                const key = `${pea.config.id}:${svc.tag}`
                                                const selectedCommand = serviceCmdSelections[key]?.command ?? allowed[0]
                                                return (
                                            <Box key={svc.tag} sx={{
                                                display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'center', mt: 0.5, gap: 1, flexWrap: 'wrap'
                                            }}>
                                                <Typography variant="body2">{svc.tag}</Typography>
                                                <Chip
                                                    size="small"
                                                    label={svc.state}
                                                    color={getStateColor(svc.state)}
                                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                                />
                                                {pea.running && (
                                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                        <Select
                                                            size="small"
                                                            value={(selectedCommand ?? '') as string}
                                                            onChange={(e) => setServiceCmdSelections(prev => ({
                                                                ...prev,
                                                                [key]: {
                                                                    ...(prev[key] ?? {}),
                                                                    command: e.target.value as ServiceCommand,
                                                                },
                                                            }))}
                                                            sx={{ minWidth: 110, height: 28, fontSize: '0.75rem' }}
                                                            disabled={allowed.length === 0}
                                                        >
                                                            {allowed.length === 0 && <MenuItem value="">No Commands</MenuItem>}
                                                            {allowed.map(cmd => (
                                                                <MenuItem key={cmd} value={cmd}>{cmd}</MenuItem>
                                                            ))}
                                                        </Select>
                                                        <Select
                                                            size="small"
                                                            value={serviceCmdSelections[`${pea.config.id}:${svc.tag}`]?.procedureId ?? ''}
                                                            displayEmpty
                                                            onChange={(e) => setServiceCmdSelections(prev => ({
                                                                ...prev,
                                                                [key]: {
                                                                    ...(prev[key] ?? { command: selectedCommand ?? ServiceCommand.Start }),
                                                                    procedureId: e.target.value === '' ? undefined : Number(e.target.value),
                                                                },
                                                            }))}
                                                            sx={{ minWidth: 90, height: 28, fontSize: '0.75rem' }}
                                                        >
                                                            <MenuItem value="">Auto Proc</MenuItem>
                                                            {(pea.config.services.find(s => s.tag === svc.tag)?.procedures ?? []).map(proc => (
                                                                <MenuItem key={proc.id} value={proc.id}>{proc.id}</MenuItem>
                                                            ))}
                                                        </Select>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => handleServiceCommand(pea.config.id, svc.tag)}
                                                            disabled={actionInProgress !== null || allowed.length === 0}
                                                        >
                                                            Send
                                                        </Button>
                                                    </Box>
                                                )}
                                            </Box>
                                                )
                                            })()
                                        ))}
                                    </Box>
                                )}
                            </CardContent>

                            <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                                {!pea.deployed && (
                                    <Button size="small" startIcon={<CloudUpload />}
                                        onClick={() => handleDeploy(pea.config.id)}
                                        disabled={actionInProgress !== null}>
                                        Deploy
                                    </Button>
                                )}
                                {pea.deployed && !pea.running && (
                                    <Button size="small" color="success" startIcon={<PlayArrow />}
                                        onClick={() => handleStart(pea.config.id)}
                                        disabled={actionInProgress !== null}>
                                        Start
                                    </Button>
                                )}
                                {pea.running && (
                                    <Button size="small" color="error" startIcon={<Stop />}
                                        onClick={() => handleStop(pea.config.id)}
                                        disabled={actionInProgress !== null}>
                                        Stop
                                    </Button>
                                )}
                                {pea.deployed && !pea.running && (
                                    <Button size="small" color="warning"
                                        onClick={() => handleUndeploy(pea.config.id)}
                                        disabled={actionInProgress !== null}>
                                        Undeploy
                                    </Button>
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Paper>
    )
}

export default RuntimeControl
