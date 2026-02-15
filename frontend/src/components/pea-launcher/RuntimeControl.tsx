import React, { useState, useEffect } from 'react'
import { Paper, Typography, Box, Button, Chip, LinearProgress } from '@mui/material'
import { PlayArrow, Stop, Refresh } from '@mui/icons-material'
import zenohService from '../../services/zenohService'

const RuntimeControl: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false)
    const [status, setStatus] = useState('STOPPED')

    useEffect(() => {
        const unsubscribe = zenohService.subscribe('pea-launcher/status', (data) => {
            setIsRunning(data.running)
            setStatus(data.status)
        })
        return () => unsubscribe()
    }, [])

    const handleStart = () => {
        zenohService.publish('pea-launcher/command', { command: 'start' })
        // Optimistic update
        setIsRunning(true)
        setStatus('STARTING')
    }

    const handleStop = () => {
        zenohService.publish('pea-launcher/command', { command: 'stop' })
        // Optimistic update
        setIsRunning(false)
        setStatus('STOPPING')
    }

    const handleRestart = () => {
        handleStop()
        setTimeout(handleStart, 1000)
    }

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Runtime Control
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', mt: 2 }}>
                <Chip
                    label={status}
                    color={isRunning ? 'success' : 'error'}
                    variant={isRunning ? 'filled' : 'outlined'}
                    sx={{ fontSize: '1.2rem', py: 2, px: 3 }}
                />

                {status === 'STARTING' && <LinearProgress sx={{ width: '100%' }} />}

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={<PlayArrow />}
                        disabled={isRunning}
                        onClick={handleStart}
                    >
                        Start Runtime
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        size="large"
                        startIcon={<Stop />}
                        disabled={!isRunning}
                        onClick={handleStop}
                    >
                        Stop Runtime
                    </Button>
                </Box>

                <Button startIcon={<Refresh />} onClick={handleRestart} disabled={!isRunning}>
                    Restart Service
                </Button>
            </Box>

            <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Connection Details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    OPC UA Server Endpoint: opc.tcp://localhost:4840
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    MTP File Status: Valid
                </Typography>
            </Box>
        </Paper>
    )
}

export default RuntimeControl
