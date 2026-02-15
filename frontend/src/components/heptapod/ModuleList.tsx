import React, { useEffect, useState } from 'react'
import { Paper, Typography, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip } from '@mui/material'
import { PlayArrow, Stop } from '@mui/icons-material'
import zenohService from '../../services/zenohService'

interface Module {
    id: string
    name: string
    state: 'IDLE' | 'RUNNING' | 'ERROR' | 'OFFLINE'
}

const ModuleList: React.FC = () => {
    const [modules, setModules] = useState<Module[]>([
        { id: 'module-001', name: 'Processing Station', state: 'IDLE' },
        { id: 'module-002', name: 'Testing Station', state: 'OFFLINE' }
    ])

    useEffect(() => {
        // Subscribe to module updates
        // Topic: heptapod/modules/+/status
        const unsubscribe = zenohService.subscribe('heptapod/modules/+/status', (data) => {
            // Logic to update module list based on incoming data
            // For now, we'll just log it as we haven't implemented the backend part yet
            console.log('Module status update:', data)
        })
        return () => unsubscribe()
    }, [])

    const handleStart = (id: string) => {
        zenohService.publish(`heptapod/modules/${id}/command`, { command: 'start' })
    }

    const handleStop = (id: string) => {
        zenohService.publish(`heptapod/modules/${id}/command`, { command: 'stop' })
    }

    const getStateColor = (state: string) => {
        switch (state) {
            case 'RUNNING': return 'success'
            case 'IDLE': return 'warning'
            case 'ERROR': return 'error'
            default: return 'default'
        }
    }

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Connected Modules
            </Typography>
            <List>
                {modules.map((module) => (
                    <ListItem key={module.id} divider>
                        <ListItemText
                            primary={module.name}
                            secondary={`ID: ${module.id}`}
                        />
                        <Chip
                            label={module.state}
                            color={getStateColor(module.state) as any}
                            size="small"
                            sx={{ mr: 2 }}
                        />
                        <ListItemSecondaryAction>
                            <IconButton edge="end" aria-label="start" onClick={() => handleStart(module.id)} color="primary">
                                <PlayArrow />
                            </IconButton>
                            <IconButton edge="end" aria-label="stop" onClick={() => handleStop(module.id)} color="error">
                                <Stop />
                            </IconButton>
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
            </List>
        </Paper>
    )
}

export default ModuleList
