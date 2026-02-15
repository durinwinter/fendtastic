import React, { useState } from 'react'
import { Paper, Typography, Box, TextField, Button, FormControlLabel, Switch } from '@mui/material'

const SettingsView: React.FC = () => {
    const [databusUrl, setDatabusUrl] = useState('tcp://127.0.0.1:1883')
    const [enableLogging, setEnableLogging] = useState(true)

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Settings</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                <TextField
                    label="Industrial Zenoh Bus URL"
                    value={databusUrl}
                    onChange={(e) => setDatabusUrl(e.target.value)}
                    fullWidth
                    helperText="Connection string for the internal MQTT zenoh bus"
                />

                <FormControlLabel
                    control={<Switch checked={enableLogging} onChange={(e) => setEnableLogging(e.target.checked)} />}
                    label="Enable Debug Logging"
                />

                <Button variant="contained" color="primary">
                    Save Settings
                </Button>
            </Box>
        </Paper>
    )
}

export default SettingsView
