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

export default function RuntimeShell({ section, onSectionChange, workspace, inspectorTitle, inspectorLines, inspectorStatus = 'ok' }: RuntimeShellProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 2, height: '100%' }}>
      <SectionNav section={section} onChange={onSectionChange} />
      <Box sx={{ minWidth: 0, height: '100%' }}>{workspace}</Box>
      <InspectorPanel title={inspectorTitle} lines={inspectorLines} status={inspectorStatus} />
    </Box>
  )
}
