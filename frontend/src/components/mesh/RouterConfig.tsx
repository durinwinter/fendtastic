import React, { useEffect, useState, useCallback } from 'react'
import {
  Box, Paper, Typography, Card, CardContent, Chip, Button, TextField,
  Alert, Skeleton, Snackbar, IconButton, Tooltip, Divider,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Router as RouterIcon,
  Wifi as WifiIcon,
  Storage as StorageIcon,
  Sensors as SensorsIcon,
} from '@mui/icons-material'
import apiService from '../../services/apiService'

const RouterConfig: React.FC = () => {
  const [routerData, setRouterData] = useState<{ local_zid: string; entries: unknown[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedJson, setEditedJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false, message: '', severity: 'success',
  })

  const fetchRouterInfo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getMeshRouter()
      setRouterData(data)
      setEditedJson(JSON.stringify(data, null, 2))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch router info'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRouterInfo()
  }, [fetchRouterInfo])

  const handleSave = async () => {
    setSaving(true)
    try {
      const parsed = JSON.parse(editedJson)
      // For now we just validate the JSON — real admin space puts need specific keys
      await apiService.updateMeshConfig({
        admin_key: '@/router/local/config',
        value: parsed,
      })
      setSnackbar({ open: true, message: 'Configuration update sent', severity: 'success' })
      setEditing(false)
      fetchRouterInfo()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update config'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Extract structured info from raw admin space entries
  const extractInfo = () => {
    if (!routerData) return null

    const info: Record<string, unknown> = {}
    for (const entry of routerData.entries as Array<{ key?: string; value?: unknown }>) {
      if (entry.key) {
        // Strip the @/<zid>/ prefix for display
        const displayKey = entry.key.replace(/^@\/[^/]+\//, '')
        info[displayKey] = entry.value
      }
    }
    return info
  }

  if (loading) {
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={300} />
        </Paper>
      </Box>
    )
  }

  const parsedInfo = extractInfo()

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Header with actions */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RouterIcon color="primary" />
            <Box>
              <Typography variant="h6">Zenoh Router Configuration</Typography>
              {routerData && (
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                  ZID: {routerData.local_zid}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchRouterInfo} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {!editing ? (
              <Button
                startIcon={<EditIcon />}
                variant="outlined"
                size="small"
                onClick={() => setEditing(true)}
              >
                Edit Raw
              </Button>
            ) : (
              <>
                <Button
                  startIcon={<CancelIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEditing(false)
                    setEditedJson(JSON.stringify(routerData, null, 2))
                  }}
                >
                  Cancel
                </Button>
                <Button
                  startIcon={<SaveIcon />}
                  variant="contained"
                  size="small"
                  onClick={handleSave}
                  disabled={saving}
                >
                  Save
                </Button>
              </>
            )}
          </Box>
        </Box>

        {editing && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Changes to the router configuration may disconnect existing sessions.
            Only modify settings you understand.
          </Alert>
        )}
      </Paper>

      {editing ? (
        /* Edit Mode: Raw JSON */
        <Paper sx={{ p: 3 }}>
          <TextField
            multiline
            fullWidth
            minRows={20}
            maxRows={40}
            value={editedJson}
            onChange={(e) => setEditedJson(e.target.value)}
            InputProps={{
              sx: {
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: 'background.default',
              },
            }}
          />
        </Paper>
      ) : (
        /* Read Mode: Structured Cards */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Session Info Card */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <RouterIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">Session Info</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Local ZID</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {routerData?.local_zid || 'Unknown'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Mode</Typography>
                  <Typography variant="body2">
                    <Chip label="peer" size="small" color="secondary" variant="outlined" />
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Admin Entries</Typography>
                  <Typography variant="body2">{routerData?.entries?.length || 0} keys</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Admin Space Entries */}
          {parsedInfo && Object.keys(parsedInfo).length > 0 && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SensorsIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">Admin Space Entries</Typography>
                </Box>

                {Object.entries(parsedInfo).map(([key, value], i) => (
                  <React.Fragment key={key}>
                    {i > 0 && <Divider sx={{ my: 1.5 }} />}
                    <Box>
                      <Typography variant="caption" color="primary" fontFamily="monospace">
                        {key}
                      </Typography>
                      <Box sx={{
                        mt: 0.5,
                        p: 1,
                        backgroundColor: 'background.default',
                        borderRadius: 1,
                        overflow: 'auto',
                        maxHeight: 150,
                      }}>
                        <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
                          {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                        </pre>
                      </Box>
                    </Box>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Reference */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">Current Zenoh Router Config File</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                The running Zenoh router uses the config at <code>config/zenoh-router.json5</code>.
                To make persistent changes, edit that file and restart the router container.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip icon={<WifiIcon />} label="TCP :7447" size="small" variant="outlined" />
                <Chip icon={<WifiIcon />} label="WS :8000" size="small" variant="outlined" />
                <Chip icon={<StorageIcon />} label="Memory Storage: fendtastic/**" size="small" variant="outlined" />
                <Chip icon={<SensorsIcon />} label="Multicast Scouting" size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

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

export default RouterConfig
