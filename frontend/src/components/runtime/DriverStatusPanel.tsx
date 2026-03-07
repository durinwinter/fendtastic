import { Alert, Box, Chip, Paper, Typography } from '@mui/material'
import { DriverStatusSnapshot } from '../../types/driver'

interface DriverStatusPanelProps {
  status: DriverStatusSnapshot | null
}

export default function DriverStatusPanel({ status }: DriverStatusPanelProps) {
  if (!status) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert severity="info">Driver status not loaded yet.</Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Live Status</Typography>
        <Chip size="small" label={status.state} color={status.remote_running ? 'success' : 'warning'} />
      </Box>
      <Typography variant="body2">Node: {status.node_name}</Typography>
      <Typography variant="body2" color="text.secondary">Remote running: {String(status.remote_running ?? false)}</Typography>
      <Typography variant="body2" color="text.secondary">Link: {status.remote_link ?? 'n/a'}</Typography>
      <Typography variant="body2" color="text.secondary">RTT: {status.remote_rtt ?? 'n/a'}</Typography>
      {status.last_error && <Alert severity="error" sx={{ mt: 2 }}>{status.last_error}</Alert>}
      {status.last_read && (
        <Alert severity={status.last_read.ok ? 'success' : 'warning'} sx={{ mt: 2 }}>
          Last read: {status.last_read.tag_name} = {JSON.stringify(status.last_read.value)}
        </Alert>
      )}
      {status.last_write && (
        <Alert severity={status.last_write.ok ? 'success' : 'warning'} sx={{ mt: 2 }}>
          Last write: {status.last_write.tag_name} = {JSON.stringify(status.last_write.value)}
        </Alert>
      )}
    </Paper>
  )
}
