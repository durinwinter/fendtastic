import { Alert, Button, Paper, Typography } from '@mui/material'
import { DriverInstance } from '../../types/driver'
import { PeaBinding } from '../../types/binding'
import { RuntimeNode } from '../../types/runtime'

interface BindingDesignerProps {
  runtimeNode: RuntimeNode | null
  driver: DriverInstance | null
  binding: PeaBinding | null
  onCreate: (payload: any) => Promise<void>
  onValidate: (id: string) => Promise<void>
}

export default function BindingDesigner({ runtimeNode, driver, binding, onCreate, onValidate }: BindingDesignerProps) {
  const handleCreate = async () => {
    if (!runtimeNode || !runtimeNode.assigned_pea_id || !driver) return
    const firstTag = driver.tag_groups[0]?.tags[0]
    if (!firstTag) return
    await onCreate({
      pea_id: runtimeNode.assigned_pea_id,
      runtime_node_id: runtimeNode.id,
      driver_instance_id: driver.id,
      mappings: [
        {
          canonical_tag: 'active.valve_1.open_cmd',
          driver_tag_id: firstTag.id,
          direction: 'WriteToDriver',
          transform: null,
        },
      ],
    })
  }

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Binding Designer</Typography>
      {!driver ? (
        <Alert severity="info">Create a driver before creating bindings.</Alert>
      ) : binding ? (
        <>
          <Alert severity={binding.validation.valid ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {binding.validation.valid ? 'Binding validated' : 'Binding has issues'}
          </Alert>
          <Button variant="outlined" onClick={() => onValidate(binding.id)}>Revalidate Binding</Button>
        </>
      ) : (
        <Button variant="contained" onClick={handleCreate} disabled={driver.tag_groups.length === 0}>Create Starter Binding</Button>
      )}
    </Paper>
  )
}
