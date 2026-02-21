import React from 'react'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, IconButton, Button, Box
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { IndicatorElement, TagMapping, ProtocolType } from '../../types/mtp'

interface IndicatorTableProps {
  indicators: IndicatorElement[]
  onChange: (indicators: IndicatorElement[]) => void
  title?: string
}

const INDICATOR_TYPES = ['AnaView', 'BinView', 'BinStringView', 'DIntView', 'DIntStringView', 'StringView'] as const

function createDefault(type: typeof INDICATOR_TYPES[number]): IndicatorElement {
  switch (type) {
    case 'AnaView':
      return { type: 'AnaView', tag: '', name: '', unit: '', v_scl_min: 0, v_scl_max: 100, tag_mapping: null }
    case 'BinView':
      return { type: 'BinView', tag: '', name: '', v_state0: 'OFF', v_state1: 'ON', tag_mapping: null }
    case 'BinStringView':
      return { type: 'BinStringView', tag: '', name: '', v_state0: 'OFF', v_state1: 'ON', tag_mapping: null }
    case 'DIntView':
      return { type: 'DIntView', tag: '', name: '', unit: '', v_scl_min: 0, v_scl_max: 100, tag_mapping: null }
    case 'DIntStringView':
      return { type: 'DIntStringView', tag: '', name: '', v_scl_min: 0, v_scl_max: 100, tag_mapping: null }
    case 'StringView':
      return { type: 'StringView', tag: '', name: '', tag_mapping: null }
  }
}

const IndicatorTable: React.FC<IndicatorTableProps> = ({ indicators, onChange, title }) => {
  const handleAdd = () => {
    onChange([...indicators, createDefault('AnaView')])
  }

  const handleDelete = (index: number) => {
    onChange(indicators.filter((_, i) => i !== index))
  }

  const updateField = (index: number, field: string, value: unknown) => {
    const updated = [...indicators]
    updated[index] = { ...updated[index], [field]: value } as IndicatorElement
    onChange(updated)
  }

  const updateMapping = (index: number, mapping: TagMapping | null) => {
    const updated = [...indicators]
    updated[index] = { ...updated[index], tag_mapping: mapping } as IndicatorElement
    onChange(updated)
  }

  const handleTypeChange = (index: number, newType: typeof INDICATOR_TYPES[number]) => {
    const old = indicators[index]
    const next = createDefault(newType)
    next.tag = old.tag
    next.name = old.name
    const updated = [...indicators]
    updated[index] = next
    onChange(updated)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        {title && <Box sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</Box>}
        <Button size="small" startIcon={<Add />} onClick={handleAdd}>Add</Button>
      </Box>
      {indicators.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tag</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Protocol</TableCell>
                <TableCell>Address</TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {indicators.map((ind, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TextField size="small" value={ind.tag} variant="standard" fullWidth
                      onChange={(e) => updateField(index, 'tag', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={ind.name} variant="standard" fullWidth
                      onChange={(e) => updateField(index, 'name', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Select size="small" value={ind.type} variant="standard"
                      onChange={(e) => handleTypeChange(index, e.target.value as typeof INDICATOR_TYPES[number])}>
                      {INDICATOR_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {(ind.type === 'AnaView' || ind.type === 'DIntView') && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField size="small" label="Unit" variant="standard" value={ind.unit} sx={{ width: 50 }}
                          onChange={(e) => updateField(index, 'unit', e.target.value)} />
                        <TextField size="small" label="Min" type="number" variant="standard"
                          value={ind.v_scl_min} sx={{ width: 50 }}
                          onChange={(e) => updateField(index, 'v_scl_min', Number(e.target.value))} />
                        <TextField size="small" label="Max" type="number" variant="standard"
                          value={ind.v_scl_max} sx={{ width: 50 }}
                          onChange={(e) => updateField(index, 'v_scl_max', Number(e.target.value))} />
                      </Box>
                    )}
                    {ind.type === 'BinView' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField size="small" label="State0" variant="standard" value={ind.v_state0} sx={{ width: 60 }}
                          onChange={(e) => updateField(index, 'v_state0', e.target.value)} />
                        <TextField size="small" label="State1" variant="standard" value={ind.v_state1} sx={{ width: 60 }}
                          onChange={(e) => updateField(index, 'v_state1', e.target.value)} />
                      </Box>
                    )}
                    {ind.type === 'BinStringView' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField size="small" label="State0" variant="standard" value={ind.v_state0} sx={{ width: 60 }}
                          onChange={(e) => updateField(index, 'v_state0', e.target.value)} />
                        <TextField size="small" label="State1" variant="standard" value={ind.v_state1} sx={{ width: 60 }}
                          onChange={(e) => updateField(index, 'v_state1', e.target.value)} />
                      </Box>
                    )}
                    {ind.type === 'DIntStringView' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField size="small" label="Min" type="number" variant="standard"
                          value={ind.v_scl_min} sx={{ width: 50 }}
                          onChange={(e) => updateField(index, 'v_scl_min', Number(e.target.value))} />
                        <TextField size="small" label="Max" type="number" variant="standard"
                          value={ind.v_scl_max} sx={{ width: 50 }}
                          onChange={(e) => updateField(index, 'v_scl_max', Number(e.target.value))} />
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select size="small" variant="standard" displayEmpty
                      value={ind.tag_mapping?.protocol ?? ''}
                      onChange={(e) => {
                        const protocol = e.target.value as ProtocolType
                        if (!protocol) { updateMapping(index, null) }
                        else { updateMapping(index, { protocol, address: ind.tag_mapping?.address ?? '' }) }
                      }}>
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="OpcUa">OPC UA</MenuItem>
                      <MenuItem value="Modbus">Modbus</MenuItem>
                      <MenuItem value="Zenoh">Zenoh</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {ind.tag_mapping && (
                      <TextField size="small" variant="standard" placeholder="ns=2;s=..." fullWidth
                        value={ind.tag_mapping.address}
                        onChange={(e) => updateMapping(index, { ...ind.tag_mapping!, address: e.target.value })} />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleDelete(index)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

export default IndicatorTable
