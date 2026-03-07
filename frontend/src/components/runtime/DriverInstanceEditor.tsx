import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { DriverCatalogEntry, DriverInstance } from '../../types/driver'
import { RuntimeNode } from '../../types/runtime'

interface DriverInstanceEditorProps {
  runtimeNode: RuntimeNode | null
  driver: DriverInstance | null
  catalog: DriverCatalogEntry[]
  onCreate: (payload: any) => Promise<void>
  onStart: (id: string) => Promise<void>
  onStop: (id: string) => Promise<void>
}

export default function DriverInstanceEditor({ runtimeNode, driver, catalog, onCreate, onStart, onStop }: DriverInstanceEditorProps) {
  const s7 = catalog.find((entry) => entry.key === 'siemens-s7')

  const handleCreate = async () => {
    if (!runtimeNode || !runtimeNode.assigned_pea_id || !s7) return
    await onCreate({
      runtime_node_id: runtimeNode.id,
      pea_id: runtimeNode.assigned_pea_id,
      driver_key: s7.key,
      display_name: `${runtimeNode.name} S7`,
      config: {
        host: runtimeNode.host,
        port: 102,
        rack: 0,
        slot: 1,
        poll_ms: 500,
      },
    })
  }

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Driver Instance</Typography>
      {!runtimeNode ? (
        <Alert severity="info">Select a runtime node first.</Alert>
      ) : driver ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2">{driver.display_name}</Typography>
          <Typography variant="body2" color="text.secondary">{driver.driver_key} | {driver.state}</Typography>
          <Button variant="contained" onClick={() => onStart(driver.id)}>Start Driver</Button>
          <Button variant="outlined" onClick={() => onStop(driver.id)}>Stop Driver</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">No driver instance for this node yet.</Alert>
          <Button variant="contained" onClick={handleCreate} disabled={!runtimeNode.assigned_pea_id || !s7}>Create Siemens S7 Driver</Button>
        </Box>
      )}
    </Paper>
  )
}
