import { Box, Button } from '@mui/material'

export type RuntimeSection = 'pea' | 'runtime' | 'driver' | 'binding' | 'authority'

interface SectionNavProps {
  section: RuntimeSection
  onChange: (section: RuntimeSection) => void
}

const sections: Array<{ id: RuntimeSection; label: string }> = [
  { id: 'pea', label: 'PEAs' },
  { id: 'runtime', label: 'Runtime Nodes' },
  { id: 'driver', label: 'Drivers' },
  { id: 'binding', label: 'Bindings' },
  { id: 'authority', label: 'Authority' },
]

export default function SectionNav({ section, onChange }: SectionNavProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {sections.map((item) => (
        <Button
          key={item.id}
          variant={section === item.id ? 'contained' : 'outlined'}
          color={section === item.id ? 'primary' : 'inherit'}
          onClick={() => onChange(item.id)}
          sx={{ justifyContent: 'flex-start', px: 2 }}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  )
}
