import React from 'react'
import {
  Accordion, AccordionSummary, AccordionDetails, Typography,
  TextField, Box, Button, IconButton, Chip, Select, MenuItem
} from '@mui/material'
import { ExpandMore, Add, Delete } from '@mui/icons-material'
import { ActiveElement, TagMapping, ProtocolType } from '../../types/mtp'

interface ActiveElementEditorProps {
  elements: ActiveElement[]
  onChange: (elements: ActiveElement[]) => void
}

const ELEMENT_TYPES = ['BinVlv', 'AnaVlv', 'BinDrv', 'AnaDrv', 'PIDCtrl'] as const
type ElementType = typeof ELEMENT_TYPES[number]

const TYPE_LABELS: Record<ElementType, string> = {
  BinVlv: 'Binary Valve',
  AnaVlv: 'Analog Valve',
  BinDrv: 'Binary Drive',
  AnaDrv: 'Analog Drive',
  PIDCtrl: 'PID Controller',
}

function createDefault(type: ElementType): ActiveElement {
  switch (type) {
    case 'BinVlv':
      return { element_type: 'BinVlv', tag: '', name: '', safe_pos: false,
        open_fbk_tag: null, close_fbk_tag: null, open_cmd_tag: null, close_cmd_tag: null }
    case 'AnaVlv':
      return { element_type: 'AnaVlv', tag: '', name: '', safe_pos: 0,
        pos_min: 0, pos_max: 100, pos_unit: '%', pos_fbk_tag: null, pos_sp_tag: null }
    case 'BinDrv':
      return { element_type: 'BinDrv', tag: '', name: '', safe_pos: false,
        fwd_fbk_tag: null, rev_fbk_tag: null, fwd_cmd_tag: null, rev_cmd_tag: null, stop_cmd_tag: null }
    case 'AnaDrv':
      return { element_type: 'AnaDrv', tag: '', name: '', safe_pos: 0,
        rpm_min: 0, rpm_max: 3000, rpm_unit: 'RPM',
        rpm_fbk_tag: null, rpm_sp_tag: null, fwd_cmd_tag: null, rev_cmd_tag: null, stop_cmd_tag: null }
    case 'PIDCtrl':
      return { element_type: 'PIDCtrl', tag: '', name: '', kp: 1, ki: 0, kd: 0,
        pv_unit: '', pv_scl_min: 0, pv_scl_max: 100, sp_scl_min: 0, sp_scl_max: 100,
        mv_scl_min: 0, mv_scl_max: 100, pv_tag: null, sp_tag: null, mv_tag: null }
  }
}

const TagMappingField: React.FC<{
  label: string
  mapping: TagMapping | null
  onChange: (m: TagMapping | null) => void
}> = ({ label, mapping, onChange }) => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
    <Typography variant="caption" sx={{ width: 80, flexShrink: 0 }}>{label}</Typography>
    <Select size="small" variant="standard" displayEmpty value={mapping?.protocol ?? ''} sx={{ width: 90 }}
      onChange={(e) => {
        const p = e.target.value as ProtocolType
        if (!p) onChange(null)
        else onChange({ protocol: p, address: mapping?.address ?? '' })
      }}>
      <MenuItem value="">None</MenuItem>
      <MenuItem value="OpcUa">OPC UA</MenuItem>
      <MenuItem value="Modbus">Modbus</MenuItem>
      <MenuItem value="Zenoh">Zenoh</MenuItem>
    </Select>
    {mapping && (
      <TextField size="small" variant="standard" placeholder="address" value={mapping.address} fullWidth
        onChange={(e) => onChange({ ...mapping, address: e.target.value })} />
    )}
  </Box>
)

const ActiveElementEditor: React.FC<ActiveElementEditorProps> = ({ elements, onChange }) => {
  const handleAdd = (type: ElementType) => {
    onChange([...elements, createDefault(type)])
  }

  const handleDelete = (index: number) => {
    onChange(elements.filter((_, i) => i !== index))
  }

  const updateElement = (index: number, updates: Partial<ActiveElement>) => {
    const updated = [...elements]
    updated[index] = { ...updated[index], ...updates } as ActiveElement
    onChange(updated)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        {ELEMENT_TYPES.map(type => (
          <Button key={type} size="small" variant="outlined" startIcon={<Add />}
            onClick={() => handleAdd(type)}>
            {TYPE_LABELS[type]}
          </Button>
        ))}
      </Box>
      {elements.map((elem, index) => (
        <Accordion key={index} sx={{ bgcolor: 'background.default', mb: 0.5 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Chip label={elem.element_type} size="small" color="secondary" variant="outlined" />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {elem.name || elem.tag || 'New Element'}
              </Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(index) }} sx={{ ml: 'auto' }}>
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Tag" size="small" value={elem.tag}
                  onChange={(e) => updateElement(index, { tag: e.target.value })} sx={{ width: 200 }} />
                <TextField label="Name" size="small" value={elem.name} fullWidth
                  onChange={(e) => updateElement(index, { name: e.target.value })} />
              </Box>

              {elem.element_type === 'BinVlv' && (
                <>
                  <TagMappingField label="Open Fbk" mapping={elem.open_fbk_tag}
                    onChange={(m) => updateElement(index, { open_fbk_tag: m })} />
                  <TagMappingField label="Close Fbk" mapping={elem.close_fbk_tag}
                    onChange={(m) => updateElement(index, { close_fbk_tag: m })} />
                  <TagMappingField label="Open Cmd" mapping={elem.open_cmd_tag}
                    onChange={(m) => updateElement(index, { open_cmd_tag: m })} />
                  <TagMappingField label="Close Cmd" mapping={elem.close_cmd_tag}
                    onChange={(m) => updateElement(index, { close_cmd_tag: m })} />
                </>
              )}

              {elem.element_type === 'AnaVlv' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField label="Pos Min" size="small" type="number" value={elem.pos_min} sx={{ width: 100 }}
                      onChange={(e) => updateElement(index, { pos_min: Number(e.target.value) })} />
                    <TextField label="Pos Max" size="small" type="number" value={elem.pos_max} sx={{ width: 100 }}
                      onChange={(e) => updateElement(index, { pos_max: Number(e.target.value) })} />
                    <TextField label="Unit" size="small" value={elem.pos_unit} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { pos_unit: e.target.value })} />
                  </Box>
                  <TagMappingField label="Pos Fbk" mapping={elem.pos_fbk_tag}
                    onChange={(m) => updateElement(index, { pos_fbk_tag: m })} />
                  <TagMappingField label="Pos SP" mapping={elem.pos_sp_tag}
                    onChange={(m) => updateElement(index, { pos_sp_tag: m })} />
                </>
              )}

              {elem.element_type === 'BinDrv' && (
                <>
                  <TagMappingField label="Fwd Fbk" mapping={elem.fwd_fbk_tag}
                    onChange={(m) => updateElement(index, { fwd_fbk_tag: m })} />
                  <TagMappingField label="Rev Fbk" mapping={elem.rev_fbk_tag}
                    onChange={(m) => updateElement(index, { rev_fbk_tag: m })} />
                  <TagMappingField label="Fwd Cmd" mapping={elem.fwd_cmd_tag}
                    onChange={(m) => updateElement(index, { fwd_cmd_tag: m })} />
                  <TagMappingField label="Rev Cmd" mapping={elem.rev_cmd_tag}
                    onChange={(m) => updateElement(index, { rev_cmd_tag: m })} />
                  <TagMappingField label="Stop Cmd" mapping={elem.stop_cmd_tag}
                    onChange={(m) => updateElement(index, { stop_cmd_tag: m })} />
                </>
              )}

              {elem.element_type === 'AnaDrv' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField label="RPM Min" size="small" type="number" value={elem.rpm_min} sx={{ width: 100 }}
                      onChange={(e) => updateElement(index, { rpm_min: Number(e.target.value) })} />
                    <TextField label="RPM Max" size="small" type="number" value={elem.rpm_max} sx={{ width: 100 }}
                      onChange={(e) => updateElement(index, { rpm_max: Number(e.target.value) })} />
                    <TextField label="Unit" size="small" value={elem.rpm_unit} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { rpm_unit: e.target.value })} />
                  </Box>
                  <TagMappingField label="RPM Fbk" mapping={elem.rpm_fbk_tag}
                    onChange={(m) => updateElement(index, { rpm_fbk_tag: m })} />
                  <TagMappingField label="RPM SP" mapping={elem.rpm_sp_tag}
                    onChange={(m) => updateElement(index, { rpm_sp_tag: m })} />
                  <TagMappingField label="Fwd Cmd" mapping={elem.fwd_cmd_tag}
                    onChange={(m) => updateElement(index, { fwd_cmd_tag: m })} />
                  <TagMappingField label="Rev Cmd" mapping={elem.rev_cmd_tag}
                    onChange={(m) => updateElement(index, { rev_cmd_tag: m })} />
                  <TagMappingField label="Stop Cmd" mapping={elem.stop_cmd_tag}
                    onChange={(m) => updateElement(index, { stop_cmd_tag: m })} />
                </>
              )}

              {elem.element_type === 'PIDCtrl' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField label="Kp" size="small" type="number" value={elem.kp} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { kp: Number(e.target.value) })} />
                    <TextField label="Ki" size="small" type="number" value={elem.ki} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { ki: Number(e.target.value) })} />
                    <TextField label="Kd" size="small" type="number" value={elem.kd} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { kd: Number(e.target.value) })} />
                    <TextField label="PV Unit" size="small" value={elem.pv_unit} sx={{ width: 80 }}
                      onChange={(e) => updateElement(index, { pv_unit: e.target.value })} />
                  </Box>
                  <TagMappingField label="PV Tag" mapping={elem.pv_tag}
                    onChange={(m) => updateElement(index, { pv_tag: m })} />
                  <TagMappingField label="SP Tag" mapping={elem.sp_tag}
                    onChange={(m) => updateElement(index, { sp_tag: m })} />
                  <TagMappingField label="MV Tag" mapping={elem.mv_tag}
                    onChange={(m) => updateElement(index, { mv_tag: m })} />
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )
}

export default ActiveElementEditor
