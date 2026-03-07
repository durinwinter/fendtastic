import { Alert, Box, Chip, Paper, Typography } from '@mui/material'

interface InspectorPanelProps {
  title: string
  lines: string[]
  status?: 'ok' | 'warn' | 'error'
}

export default function InspectorPanel({ title, lines, status = 'ok' }: InspectorPanelProps) {
  const severity = status === 'ok' ? 'success' : status === 'warn' ? 'warning' : 'error'
  return (
    <Paper sx={{ p: 2, height: '100%', background: 'linear-gradient(180deg, rgba(41,25,16,0.95), rgba(17,10,7,0.98))' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Chip size="small" label={status.toUpperCase()} color={severity} />
      </Box>
      {lines.length === 0 ? (
        <Alert severity="info">No selection</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {lines.map((line) => (
            <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>
          ))}
        </Box>
      )}
    </Paper>
  )
}
