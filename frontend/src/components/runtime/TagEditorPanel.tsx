import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { DriverSchemaPayload, DriverTag, TagGroup } from '../../types/driver'
import SchemaForm from './SchemaForm'

interface TagEditorPanelProps {
  schema: DriverSchemaPayload | null
  group: TagGroup | null
  tag: DriverTag | null
  onChange: (next: DriverTag) => void
  onAdd: () => void
}

function toFormValue(tag: DriverTag | null): Record<string, unknown> {
  if (!tag) return {}
  return {
    name: tag.name,
    address: tag.address,
    data_type: tag.data_type,
    access: tag.access,
    scan_ms: tag.scan_ms ?? 500,
    ...tag.attributes,
  }
}

function fromFormValue(tag: DriverTag, value: Record<string, unknown>): DriverTag {
  const { name, address, data_type, access, scan_ms, ...attributes } = value
  return {
    ...tag,
    name: String(name ?? tag.name),
    address: String(address ?? tag.address),
    data_type: String(data_type ?? tag.data_type) as DriverTag['data_type'],
    access: String(access ?? tag.access) as DriverTag['access'],
    scan_ms: typeof scan_ms === 'number' ? scan_ms : Number(scan_ms ?? tag.scan_ms ?? 500),
    attributes,
  }
}

export default function TagEditorPanel({ schema, group, tag, onChange, onAdd }: TagEditorPanelProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Tag Editor</Typography>
        <Button size="small" variant="outlined" onClick={onAdd}>Add Tag</Button>
      </Box>
      {!group ? (
        <Alert severity="info">Create or select a tag group first.</Alert>
      ) : !tag ? (
        <Alert severity="info">Select a tag from {group.name} to edit it.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2">Editing {tag.name}</Typography>
          <SchemaForm
            schema={(schema?.tag_schema as Record<string, any>) ?? null}
            value={toFormValue(tag)}
            onChange={(next) => onChange(fromFormValue(tag, next))}
          />
        </Box>
      )}
    </Paper>
  )
}
