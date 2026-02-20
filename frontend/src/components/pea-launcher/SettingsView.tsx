import React, { useState, useEffect } from 'react'
import {
    Paper, Typography, Box, TextField, Button, FormControlLabel,
    Switch, Snackbar, Alert, Chip
} from '@mui/material'
import zenohService from '../../services/zenohService'

const SettingsView: React.FC = () => {
    const [evaIcsUrl, setEvaIcsUrl] = useState(
        () => localStorage.getItem('fendtastic.evaIcsUrl') || 'http://localhost:7727'
    )
    const [evaApiKey, setEvaApiKey] = useState(
        () => localStorage.getItem('fendtastic.evaApiKey') || 'default-key'
    )
    const [enableLogging, setEnableLogging] = useState(
        () => localStorage.getItem('fendtastic.logging') !== 'false'
    )
    const [saved, setSaved] = useState(false)
    const [zenohConnected, setZenohConnected] = useState(false)

    useEffect(() => {
        const unsub = zenohService.onConnectionChange(setZenohConnected)
        return () => unsub()
    }, [])

    const handleSave = () => {
        localStorage.setItem('fendtastic.evaIcsUrl', evaIcsUrl)
        localStorage.setItem('fendtastic.evaApiKey', evaApiKey)
        localStorage.setItem('fendtastic.logging', String(enableLogging))
        setSaved(true)
    }

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Settings</Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="subtitle2">Zenoh Bus:</Typography>
                    <Chip
                        size="small"
                        label={zenohConnected ? 'Connected' : 'Disconnected'}
                        color={zenohConnected ? 'success' : 'error'}
                    />
                </Box>

                <TextField
                    label="EVA-ICS API URL"
                    value={evaIcsUrl}
                    onChange={(e) => setEvaIcsUrl(e.target.value)}
                    fullWidth
                    helperText="URL for the EVA-ICS JSON-RPC API"
                />

                <TextField
                    label="EVA-ICS API Key"
                    value={evaApiKey}
                    onChange={(e) => setEvaApiKey(e.target.value)}
                    fullWidth
                    type="password"
                    helperText="Authentication key for EVA-ICS"
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={enableLogging}
                            onChange={(e) => setEnableLogging(e.target.checked)}
                        />
                    }
                    label="Enable Debug Logging"
                />

                <Button variant="contained" color="primary" onClick={handleSave}>
                    Save Settings
                </Button>
            </Box>

            <Snackbar
                open={saved}
                autoHideDuration={3000}
                onClose={() => setSaved(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" onClose={() => setSaved(false)}>
                    Settings saved
                </Alert>
            </Snackbar>
        </Paper>
    )
}

export default SettingsView
