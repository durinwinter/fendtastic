import React, { useEffect, useState } from 'react'
import {
    Paper, Typography, List, ListItem, ListItemText, Chip, Box, Alert,
    Accordion, AccordionSummary, AccordionDetails
} from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import zenohService from '../../services/zenohService'
import { ServiceState, getStateColor, ZENOH_TOPICS } from '../../types/mtp'

interface DiscoveredPea {
    pea_id: string
    name: string
    version: string
    services: { tag: string; name: string }[]
    opcua_endpoint: string
    lastSeen: number
    deployed: boolean
    running: boolean
    serviceStates: Record<string, ServiceState>
}

const PEAList: React.FC = () => {
    const [peas, setPeas] = useState<Map<string, DiscoveredPea>>(new Map())

    // Auto-discover PEAs via Zenoh announcements
    useEffect(() => {
        const unsub1 = zenohService.subscribe(
            ZENOH_TOPICS.peaDiscoveryWildcard,
            (data: any) => {
                if (!data || !data.pea_id) return
                setPeas(prev => {
                    const next = new Map(prev)
                    const existing = next.get(data.pea_id)
                    next.set(data.pea_id, {
                        pea_id: data.pea_id,
                        name: data.name || data.pea_id,
                        version: data.version || '?',
                        services: data.services || [],
                        opcua_endpoint: data.opcua_endpoint || '',
                        lastSeen: Date.now(),
                        deployed: existing?.deployed ?? true,
                        running: existing?.running ?? false,
                        serviceStates: existing?.serviceStates ?? {},
                    })
                    return next
                })
            }
        )

        // Subscribe to PEA status updates
        const unsub2 = zenohService.subscribe(
            ZENOH_TOPICS.peaStatusWildcard,
            (data: any) => {
                if (!data || !data.pea_id) return
                setPeas(prev => {
                    const next = new Map(prev)
                    const existing = next.get(data.pea_id)
                    if (existing) {
                        const serviceStates: Record<string, ServiceState> = {}
                        if (data.services) {
                            for (const s of data.services) {
                                serviceStates[s.tag] = s.state as ServiceState
                            }
                        }
                        next.set(data.pea_id, {
                            ...existing,
                            deployed: data.deployed ?? existing.deployed,
                            running: data.running ?? existing.running,
                            serviceStates,
                            lastSeen: Date.now(),
                        })
                    } else {
                        // New PEA discovered via status
                        const serviceStates: Record<string, ServiceState> = {}
                        if (data.services) {
                            for (const s of data.services) {
                                serviceStates[s.tag] = s.state as ServiceState
                            }
                        }
                        next.set(data.pea_id, {
                            pea_id: data.pea_id,
                            name: data.pea_id,
                            version: '?',
                            services: data.services?.map((s: any) => ({ tag: s.tag, name: s.tag })) || [],
                            opcua_endpoint: data.opcua_endpoint || '',
                            lastSeen: Date.now(),
                            deployed: data.deployed ?? false,
                            running: data.running ?? false,
                            serviceStates,
                        })
                    }
                    return next
                })
            }
        )

        return () => { unsub1(); unsub2() }
    }, [])

    const peaList = Array.from(peas.values())

    return (
        <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
                Discovered PEAs
            </Typography>

            {peaList.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                    No PEAs discovered yet. Deploy and start PEAs from the PEA Launcher to see them here.
                </Alert>
            ) : (
                <List disablePadding>
                    {peaList.map(pea => (
                        <Accordion key={pea.pea_id} disableGutters variant="outlined" sx={{ mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                                    <ListItemText
                                        primary={pea.name}
                                        secondary={`v${pea.version} — ${pea.pea_id}`}
                                        sx={{ flex: 1 }}
                                    />
                                    <Chip
                                        size="small"
                                        label={pea.running ? 'RUNNING' : pea.deployed ? 'DEPLOYED' : 'OFFLINE'}
                                        color={pea.running ? 'success' : pea.deployed ? 'warning' : 'default'}
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                {pea.opcua_endpoint && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        OPC UA: {pea.opcua_endpoint}
                                    </Typography>
                                )}
                                {pea.services.length > 0 && (
                                    <Box>
                                        <Typography variant="caption" fontWeight="bold">Services:</Typography>
                                        <List dense disablePadding>
                                            {pea.services.map(svc => {
                                                const state = pea.serviceStates[svc.tag] || ServiceState.Idle
                                                return (
                                                    <ListItem key={svc.tag} sx={{ py: 0.25, px: 0 }}>
                                                        <ListItemText
                                                            primary={svc.name || svc.tag}
                                                            secondary={svc.tag}
                                                        />
                                                        <Chip
                                                            size="small"
                                                            label={state}
                                                            color={getStateColor(state)}
                                                            sx={{ fontSize: '0.65rem', height: 20 }}
                                                        />
                                                    </ListItem>
                                                )
                                            })}
                                        </List>
                                    </Box>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </List>
            )}
        </Paper>
    )
}

export default PEAList
