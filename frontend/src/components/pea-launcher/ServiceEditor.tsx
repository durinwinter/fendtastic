import React from 'react'
import {
  Accordion, AccordionSummary, AccordionDetails, Typography, TextField,
  Box, Button, IconButton, Switch, FormControlLabel, Chip
} from '@mui/material'
import { ExpandMore, Add, Delete } from '@mui/icons-material'
import { ServiceConfig, ProcedureConfig, createEmptyProcedure } from '../../types/mtp'
import ParameterTable from './ParameterTable'
import IndicatorTable from './IndicatorTable'

interface ServiceEditorProps {
  service: ServiceConfig
  onChange: (service: ServiceConfig) => void
  onDelete: () => void
}

const ServiceEditor: React.FC<ServiceEditorProps> = ({ service, onChange, onDelete }) => {
  const updateField = (field: keyof ServiceConfig, value: unknown) => {
    onChange({ ...service, [field]: value } as ServiceConfig)
  }

  const updateProcedure = (index: number, proc: ProcedureConfig) => {
    const procs = [...service.procedures]
    procs[index] = proc
    updateField('procedures', procs)
  }

  const addProcedure = () => {
    const nextId = service.procedures.length > 0
      ? Math.max(...service.procedures.map(p => p.id)) + 1
      : 1
    updateField('procedures', [...service.procedures, createEmptyProcedure(nextId)])
  }

  const deleteProcedure = (index: number) => {
    updateField('procedures', service.procedures.filter((_, i) => i !== index))
  }

  return (
    <Accordion sx={{ bgcolor: 'background.default', mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Chip label="SERVICE" size="small" color="primary" variant="outlined" />
          <Typography sx={{ fontWeight: 600 }}>
            {service.name || service.tag || 'New Service'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', mr: 2 }}>
            {service.procedures.length} procedure(s)
          </Typography>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Service Info */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Tag" size="small" value={service.tag}
              onChange={(e) => updateField('tag', e.target.value)} sx={{ width: 200 }} />
            <TextField label="Name" size="small" value={service.name} fullWidth
              onChange={(e) => updateField('name', e.target.value)} />
          </Box>
          <TextField label="Description" size="small" value={service.description} fullWidth multiline rows={2}
            onChange={(e) => updateField('description', e.target.value)} />

          {/* Configuration Parameters */}
          <ParameterTable
            title="Configuration Parameters"
            parameters={service.config_parameters}
            onChange={(params) => updateField('config_parameters', params)}
          />

          {/* Procedures */}
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Procedures</Typography>
              <Button size="small" startIcon={<Add />} onClick={addProcedure}>Add Procedure</Button>
            </Box>
            {service.procedures.map((proc, index) => (
              <ProcedureEditor
                key={proc.id}
                procedure={proc}
                onChange={(p) => updateProcedure(index, p)}
                onDelete={() => deleteProcedure(index)}
              />
            ))}
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

interface ProcedureEditorProps {
  procedure: ProcedureConfig
  onChange: (proc: ProcedureConfig) => void
  onDelete: () => void
}

const ProcedureEditor: React.FC<ProcedureEditorProps> = ({ procedure, onChange, onDelete }) => {
  const updateField = (field: keyof ProcedureConfig, value: unknown) => {
    onChange({ ...procedure, [field]: value } as ProcedureConfig)
  }

  return (
    <Accordion sx={{ bgcolor: 'background.paper', mb: 0.5 }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Chip label={`PROC ${procedure.id}`} size="small" variant="outlined" />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {procedure.name || 'New Procedure'}
          </Typography>
          {procedure.is_default && <Chip label="DEFAULT" size="small" color="success" />}
          {procedure.is_self_completing && <Chip label="SELF-COMPLETING" size="small" color="info" />}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete() }} sx={{ ml: 'auto' }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField label="Name" size="small" value={procedure.name} fullWidth
              onChange={(e) => updateField('name', e.target.value)} />
            <TextField label="ID" size="small" type="number" value={procedure.id}
              onChange={(e) => updateField('id', Number(e.target.value))} sx={{ width: 80 }} />
            <FormControlLabel
              control={<Switch checked={procedure.is_default} onChange={(e) => updateField('is_default', e.target.checked)} />}
              label="Default" />
            <FormControlLabel
              control={<Switch checked={procedure.is_self_completing} onChange={(e) => updateField('is_self_completing', e.target.checked)} />}
              label="Self-completing" />
          </Box>

          <ParameterTable
            title="Procedure Parameters"
            parameters={procedure.parameters}
            onChange={(params) => updateField('parameters', params)}
          />

          <IndicatorTable
            title="Process Value Outputs"
            indicators={procedure.process_value_outs}
            onChange={(inds) => updateField('process_value_outs', inds)}
          />

          <IndicatorTable
            title="Report Values"
            indicators={procedure.report_values}
            onChange={(inds) => updateField('report_values', inds)}
          />
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

export default ServiceEditor
