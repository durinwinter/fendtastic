import { Box } from '@mui/material'
import SectionNav, { RuntimeSection } from './SectionNav'
import InspectorPanel from './InspectorPanel'
import React from 'react'

interface RuntimeShellProps {
  section: RuntimeSection
  onSectionChange: (section: RuntimeSection) => void
  workspace: React.ReactNode
  inspectorTitle: string
  inspectorLines: string[]
  inspectorStatus?: 'ok' | 'warn' | 'error'
}

export default function RuntimeShell({
  section,
  onSectionChange,
  workspace,
  inspectorTitle,
  inspectorLines,
  inspectorStatus = 'ok',
}: RuntimeShellProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 330px',
        gap: 2,
        height: '100%',
        minHeight: 0,
      }}
    >
      <SectionNav section={section} onChange={onSectionChange} />
      <Box
        sx={{
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          borderRadius: '30px',
          border: '1px solid rgba(240,195,106,0.12)',
          backgroundImage:
            'radial-gradient(circle at 50% 120%, rgba(240,195,106,0.1), transparent 26%), linear-gradient(180deg, rgba(24,16,11,0.98), rgba(10,7,5,0.98)), var(--ent-linework-soft), var(--ent-linework)',
          backgroundSize: 'auto, auto, 320px 120px, 320px 120px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 28px rgba(0,0,0,0.22)',
          p: 2,
        }}
      >
        {workspace}
      </Box>
      <InspectorPanel title={inspectorTitle} lines={inspectorLines} status={inspectorStatus} />
    </Box>
  )
}
