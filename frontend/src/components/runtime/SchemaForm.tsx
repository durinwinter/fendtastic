import { Box, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material'

interface SchemaFormProps {
  schema: Record<string, any> | null
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

export default function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const properties = (schema?.properties ?? {}) as Record<string, any>

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
      {Object.entries(properties).map(([key, property]) => {
        const current = value[key] ?? property.default ?? ''
        if (property.type === 'boolean') {
          return (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  checked={Boolean(current)}
                  onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
                />
              }
              label={property.title || key}
            />
          )
        }

        if (Array.isArray(property.enum)) {
          return (
            <TextField
              key={key}
              select
              label={property.title || key}
              value={String(current)}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
              helperText={property.description || ''}
              fullWidth
            >
              {property.enum.map((option: string) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
          )
        }

        return (
          <TextField
            key={key}
            label={property.title || key}
            type={property.type === 'integer' || property.type === 'number' ? 'number' : 'text'}
            value={String(current)}
            onChange={(event) => {
              const raw = event.target.value
              const parsed = property.type === 'integer'
                ? Number.parseInt(raw, 10)
                : property.type === 'number'
                  ? Number.parseFloat(raw)
                  : raw
              onChange({ ...value, [key]: Number.isNaN(parsed) ? raw : parsed })
            }}
            helperText={property.description || ''}
            fullWidth
          />
        )
      })}
    </Box>
  )
}
