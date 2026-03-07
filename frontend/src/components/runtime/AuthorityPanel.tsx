import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { AuthorityState } from '../../types/authority'
import { PeaConfig } from '../../types/mtp'

interface AuthorityPanelProps {
  peas: PeaConfig[]
  authority: AuthorityState | null
  onLoad: (peaId: string) => Promise<void>
  onSetMode: (peaId: string, mode: AuthorityState['mode']) => Promise<void>
}

const modes: AuthorityState['mode'][] = [
  'ObserveOnly',
  'OperatorExclusive',
  'AutoExclusive',
  'AIAssisted',
  'AIExclusive',
  'MaintenanceExclusive',
  'EmergencyLockout',
]

export default function AuthorityPanel({ peas, authority, onLoad, onSetMode }: AuthorityPanelProps) {
  const peaId = authority?.pea_id ?? peas[0]?.id ?? ''

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Control Authority</Typography>
      {peas.length === 0 ? (
        <Alert severity="warning">No PEAs available.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField select label="PEA" value={peaId} onChange={(e) => onLoad(e.target.value)}>
            {peas.map((pea) => <MenuItem key={pea.id} value={pea.id}>{pea.name || pea.id}</MenuItem>)}
          </TextField>
          {authority && (
            <>
              <Typography variant="body2">Current Mode: {authority.mode}</Typography>
              <Typography variant="caption" color="text.secondary">Updated {new Date(authority.updated_at).toLocaleString()}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {modes.map((mode) => (
                  <Button key={mode} size="small" variant={mode === authority.mode ? 'contained' : 'outlined'} onClick={() => onSetMode(authority.pea_id, mode)}>
                    {mode}
                  </Button>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}
    </Paper>
  )
}
