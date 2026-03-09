import { Alert, Box, Chip, Paper, Typography } from '@mui/material'

interface InspectorPanelProps {
  title: string
  lines: string[]
  status?: 'ok' | 'warn' | 'error'
}

export default function InspectorPanel({ title, lines, status = 'ok' }: InspectorPanelProps) {
  const severity = status === 'ok' ? 'success' : status === 'warn' ? 'warning' : 'error'

  return (
    <Paper
      sx={{
        p: 2.25,
        height: '100%',
        backgroundImage: 'var(--ent-canopy-glow), var(--ent-shell-surface), var(--ent-linework-soft), var(--ent-linework)',
        backgroundSize: 'auto, auto, 320px 120px, 320px 120px',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
            Forge Inspector
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.light' }}>
            {title}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={status.toUpperCase()}
          color={severity}
          sx={{
            minWidth: 78,
            justifyContent: 'center',
          }}
        />
      </Box>
      {lines.length === 0 ? (
        <Alert severity="info">No selection</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.15 }}>
          {lines.map((line) => (
            <Box
              key={line}
              sx={{
                pb: 1,
                borderBottom: '1px solid rgba(240,195,106,0.08)',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {line}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
