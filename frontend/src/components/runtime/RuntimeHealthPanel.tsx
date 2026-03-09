import { Alert, Box, Chip, Paper, Typography } from '@mui/material'
import { RuntimeNode, RuntimeNodeStatusSnapshot } from '../../types/runtime'

interface RuntimeHealthPanelProps {
  node: RuntimeNode | null
  status: RuntimeNodeStatusSnapshot | null
}

export default function RuntimeHealthPanel({ node, status }: RuntimeHealthPanelProps) {
  if (!node) {
    return (
      <Paper sx={{ p: 2, height: '100%' }}>
        <Alert severity="info">Select a runtime node to inspect live health checks.</Alert>
      </Paper>
    )
  }

  const checks = status?.checks ?? []
  const okCount = checks.filter((check) => check.ok).length
  const chipColor = status?.status === 'Online' ? 'success' : status?.status === 'Degraded' ? 'warning' : 'error'

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Runtime Health</Typography>
        <Chip size="small" label={status?.status ?? node.status} color={chipColor} />
      </Box>
      <Typography variant="body2">{node.name}</Typography>
      <Typography variant="body2" color="text.secondary">Host: {node.host}</Typography>
      <Typography variant="body2" color="text.secondary">Frontend Mode: {node.neuron.mode}</Typography>
      <Typography variant="body2" color="text.secondary">
        Checks: {checks.length ? `${okCount}/${checks.length}` : 'pending'}
      </Typography>
      {status?.updated_at && (
        <Typography variant="caption" color="text.secondary">
          Updated: {new Date(status.updated_at).toLocaleString()}
        </Typography>
      )}
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {checks.length === 0 ? (
          <Alert severity="info">Waiting for runtime heartbeat.</Alert>
        ) : (
          checks.map((check) => (
            <Alert key={check.name} severity={check.ok ? 'success' : 'error'}>
              <strong>{check.name}</strong>: {check.message}
            </Alert>
          ))
        )}
      </Box>
    </Paper>
  )
}
