import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { RuntimeNode } from '../../types/runtime'
import { PeaConfig } from '../../types/mtp'

interface RuntimeNodeEditorProps {
  node: RuntimeNode | null
  peas: PeaConfig[]
  onCreate: (payload: any) => Promise<void>
  onTest: (nodeId: string) => Promise<void>
}

export default function RuntimeNodeEditor({ node, peas, onCreate, onTest }: RuntimeNodeEditorProps) {
  const defaultPeaId = peas[0]?.id ?? ''

  const handleQuickCreate = async () => {
    await onCreate({
      name: `arm-node-${peas.length || 1}`,
      architecture: 'Arm64',
      host: '10.0.20.41',
      assigned_pea_id: defaultPeaId || null,
      neuron: {
        base_url: 'http://10.0.20.41:7000',
        username: 'admin',
        password_ref: 'secret://runtime/default/neuron',
        config_path: '/opt/neuron/config',
        mode: 'Hybrid',
      },
    })
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Runtime Node Editor</Typography>
      {node ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField label="Name" value={node.name} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Host" value={node.host} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Architecture" value={node.architecture} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Status" value={node.status} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Neuron URL" value={node.neuron.base_url} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Neuron Mode" value={node.neuron.mode} fullWidth InputProps={{ readOnly: true }} />
          <TextField label="Assigned PEA" value={node.assigned_pea_id ?? ''} fullWidth InputProps={{ readOnly: true }} />
          <Button variant="contained" onClick={() => onTest(node.id)}>Run Connection Test</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">Select a runtime node or create the first ARM runtime for a PEA.</Alert>
          <TextField select label="Default PEA Assignment" value={defaultPeaId} disabled>
            {peas.map((pea) => <MenuItem key={pea.id} value={pea.id}>{pea.name || pea.id}</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={handleQuickCreate} disabled={!defaultPeaId}>Create ARM Runtime Node</Button>
        </Box>
      )}
    </Paper>
  )
}
