import React, { useState } from 'react'
import {
  Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl,
  InputLabel, Switch, FormControlLabel, IconButton, Snackbar, Alert, Tooltip, Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import apiService from '../../services/apiService'

const NodeManager: React.FC = () => {
  const [mode, setMode] = useState<'router' | 'peer' | 'client'>('client')
  const [listenEndpoints, setListenEndpoints] = useState<string[]>([])
  const [connectEndpoints, setConnectEndpoints] = useState<string[]>(['tcp/localhost:7447'])
  const [multicastScouting, setMulticastScouting] = useState(true)
  const [storageEnabled, setStorageEnabled] = useState(false)
  const [storageKeyExpr, setStorageKeyExpr] = useState('fendtastic/**')
  const [generatedConfig, setGeneratedConfig] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const handleGenerate = async () => {
    try {
      const config = await apiService.generateNodeConfig({
        mode,
        listen_endpoints: listenEndpoints.filter(e => e.trim()),
        connect_endpoints: connectEndpoints.filter(e => e.trim()),
        multicast_scouting: multicastScouting,
        storage_enabled: storageEnabled,
        storage_key_expr: storageKeyExpr,
      })
      setGeneratedConfig(JSON.stringify(config, null, 2))
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate config', severity: 'error' })
    }
  }

  const handleCopy = () => {
    if (generatedConfig) {
      navigator.clipboard.writeText(generatedConfig)
      setSnackbar({ open: true, message: 'Copied to clipboard', severity: 'success' })
    }
  }

  const handleDownload = () => {
    if (generatedConfig) {
      const blob = new Blob([generatedConfig], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zenoh-${mode}-config.json5`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const addEndpoint = (list: string[], setter: (v: string[]) => void) => {
    setter([...list, ''])
  }

  const removeEndpoint = (list: string[], setter: (v: string[]) => void, index: number) => {
    setter(list.filter((_, i) => i !== index))
  }

  const updateEndpoint = (list: string[], setter: (v: string[]) => void, index: number, value: string) => {
    const updated = [...list]
    updated[index] = value
    setter(updated)
  }

  const renderEndpointList = (
    label: string,
    endpoints: string[],
    setter: (v: string[]) => void,
    placeholder: string,
  ) => (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <IconButton size="small" color="primary" onClick={() => addEndpoint(endpoints, setter)} sx={{ ml: 1 }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      {endpoints.map((ep, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            value={ep}
            onChange={(e) => updateEndpoint(endpoints, setter, i, e.target.value)}
            placeholder={placeholder}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
          />
          <IconButton size="small" color="error" onClick={() => removeEndpoint(endpoints, setter, i)}>
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      {endpoints.length === 0 && (
        <Typography variant="caption" color="text.secondary">No endpoints configured</Typography>
      )}
    </Box>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 2, overflow: 'hidden' }}>
      {/* Left: Configuration Form */}
      <Paper sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Typography variant="h6" gutterBottom>Generate Zenoh Node Configuration</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure a new Zenoh node and generate the configuration file. Download or copy
          the config to deploy the node on your network.
        </Typography>

        {/* Mode Selection */}
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Node Mode</InputLabel>
          <Select
            value={mode}
            label="Node Mode"
            onChange={(e) => setMode(e.target.value as 'router' | 'peer' | 'client')}
          >
            <MenuItem value="router">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Router
                <Chip label="Routes traffic" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 10 }} />
              </Box>
            </MenuItem>
            <MenuItem value="peer">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Peer
                <Chip label="Mesh participant" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 10 }} />
              </Box>
            </MenuItem>
            <MenuItem value="client">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Client
                <Chip label="Connects to router" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 10 }} />
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        {/* Listen Endpoints (router/peer only) */}
        {mode !== 'client' && (
          renderEndpointList(
            'Listen Endpoints',
            listenEndpoints,
            setListenEndpoints,
            'tcp/0.0.0.0:7447',
          )
        )}

        {/* Connect Endpoints */}
        {renderEndpointList(
          'Connect Endpoints',
          connectEndpoints,
          setConnectEndpoints,
          'tcp/192.168.1.10:7447',
        )}

        {/* Scouting */}
        <FormControlLabel
          control={
            <Switch
              checked={multicastScouting}
              onChange={(e) => setMulticastScouting(e.target.checked)}
              color="primary"
            />
          }
          label="Multicast Scouting (LAN auto-discovery)"
          sx={{ mb: 2, display: 'block' }}
        />

        {/* Storage */}
        <FormControlLabel
          control={
            <Switch
              checked={storageEnabled}
              onChange={(e) => setStorageEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="Enable In-Memory Storage"
          sx={{ mb: 1, display: 'block' }}
        />
        {storageEnabled && (
          <TextField
            size="small"
            fullWidth
            label="Storage Key Expression"
            value={storageKeyExpr}
            onChange={(e) => setStorageKeyExpr(e.target.value)}
            sx={{ mb: 3 }}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
          />
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={handleGenerate}
          sx={{ mt: 2 }}
        >
          Generate Configuration
        </Button>
      </Paper>

      {/* Right: Generated Config */}
      <Paper sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Generated Config</Typography>
          {generatedConfig && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Copy to clipboard">
                <IconButton size="small" onClick={handleCopy} color="primary">
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download as .json5">
                <IconButton size="small" onClick={handleDownload} color="primary">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {generatedConfig ? (
          <Box sx={{
            flex: 1,
            p: 2,
            backgroundColor: 'background.default',
            borderRadius: 1,
            overflow: 'auto',
          }}>
            <pre style={{
              margin: 0,
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              color: '#6EC72D',
            }}>
              {generatedConfig}
            </pre>
          </Box>
        ) : (
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
            borderRadius: 1,
          }}>
            <Typography color="text.secondary">
              Configure the node and click "Generate Configuration"
            </Typography>
          </Box>
        )}

        {generatedConfig && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Save this file as <code>zenoh-config.json5</code> and start Zenoh with:
            <br />
            <code style={{ fontFamily: 'monospace' }}>
              zenohd -c zenoh-config.json5
            </code>
            <br />
            Or use Docker:
            <br />
            <code style={{ fontFamily: 'monospace' }}>
              docker run -v ./zenoh-config.json5:/etc/zenoh/config.json5 eclipse/zenoh -c /etc/zenoh/config.json5
            </code>
          </Alert>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default NodeManager
