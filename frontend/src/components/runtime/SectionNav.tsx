import { Box, Button, Typography } from '@mui/material'

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
    <Box
      sx={{
        height: '100%',
        p: 2,
        borderRadius: '28px',
        border: '1px solid rgba(240,195,106,0.14)',
        backgroundImage: 'var(--ent-canopy-glow), var(--ent-panel-surface), var(--ent-linework-soft), var(--ent-linework)',
        backgroundSize: 'auto, auto, 320px 120px, 320px 120px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -24px 32px rgba(0,0,0,0.18), 0 18px 28px rgba(0,0,0,0.22)',
      }}
    >
      <Typography
        variant="h6"
        sx={{ color: 'secondary.light', mb: 1.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        Runtime Studio
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Carved workflow rail for nodes, drivers, bindings, and authority.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {sections.map((item) => (
          <Button
            key={item.id}
            variant={section === item.id ? 'contained' : 'outlined'}
            color={section === item.id ? 'primary' : 'inherit'}
            onClick={() => onChange(item.id)}
            sx={{
              justifyContent: 'flex-start',
              width: '100%',
              ...(section === item.id
                ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(240,195,106,0.14), 0 10px 24px rgba(0,0,0,0.26), 0 0 20px rgba(240,195,106,0.08), 0 0 24px rgba(110,139,74,0.07)' }
                : {}),
            }}
          >
            {item.label}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
