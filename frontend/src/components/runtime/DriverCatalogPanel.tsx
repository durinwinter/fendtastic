import { Alert, Paper, Typography } from '@mui/material'
import { DriverCatalogEntry } from '../../types/driver'

interface DriverCatalogPanelProps {
  catalog: DriverCatalogEntry[]
}

export default function DriverCatalogPanel({ catalog }: DriverCatalogPanelProps) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Driver Catalog</Typography>
      {catalog.length === 0 ? (
        <Alert severity="warning">Driver catalog unavailable</Alert>
      ) : catalog.map((entry) => (
        <Alert key={entry.key} severity={entry.key === 'siemens-s7' ? 'success' : 'info'} sx={{ mb: 1 }}>
          {entry.name} ({entry.vendor})
        </Alert>
      ))}
    </Paper>
  )
}
