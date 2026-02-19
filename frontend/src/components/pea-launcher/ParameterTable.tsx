import React from 'react'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, IconButton, Button, Box
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { ServiceParameter, TagMapping, ProtocolType } from '../../types/mtp'

interface ParameterTableProps {
  parameters: ServiceParameter[]
  onChange: (params: ServiceParameter[]) => void
  title?: string
}

const PARAM_TYPES = ['Analog', 'Binary', 'DInt', 'StringParam'] as const

function createDefaultParam(type: typeof PARAM_TYPES[number]): ServiceParameter {
  switch (type) {
    case 'Analog':
      return { type: 'Analog', tag: '', name: '', unit: '', v_scl_min: 0, v_scl_max: 100, v_min: 0, v_max: 100, v_default: 0, tag_mapping: null }
    case 'Binary':
      return { type: 'Binary', tag: '', name: '', v_state0: 'OFF', v_state1: 'ON', v_default: false, tag_mapping: null }
    case 'DInt':
      return { type: 'DInt', tag: '', name: '', unit: '', v_scl_min: 0, v_scl_max: 100, v_min: 0, v_max: 100, v_default: 0, tag_mapping: null }
    case 'StringParam':
      return { type: 'StringParam', tag: '', name: '', v_default: '', tag_mapping: null }
  }
}

function getTag(p: ServiceParameter): string {
  return p.tag
}

function updateField(params: ServiceParameter[], index: number, field: string, value: unknown): ServiceParameter[] {
  const updated = [...params]
  updated[index] = { ...updated[index], [field]: value } as ServiceParameter
  return updated
}

function updateTagMapping(params: ServiceParameter[], index: number, mapping: TagMapping | null): ServiceParameter[] {
  const updated = [...params]
  updated[index] = { ...updated[index], tag_mapping: mapping } as ServiceParameter
  return updated
}

const ParameterTable: React.FC<ParameterTableProps> = ({ parameters, onChange, title }) => {
  const handleAdd = () => {
    onChange([...parameters, createDefaultParam('Analog')])
  }

  const handleDelete = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index))
  }

  const handleTypeChange = (index: number, newType: typeof PARAM_TYPES[number]) => {
    const oldParam = parameters[index]
    const newParam = createDefaultParam(newType)
    newParam.tag = getTag(oldParam)
    newParam.name = oldParam.name
    const updated = [...parameters]
    updated[index] = newParam
    onChange(updated)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        {title && <Box sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</Box>}
        <Button size="small" startIcon={<Add />} onClick={handleAdd}>
          Add Parameter
        </Button>
      </Box>
      {parameters.length > 0 && (
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
              {parameters.map((param, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TextField
                      size="small" value={param.tag} fullWidth variant="standard"
                      onChange={(e) => onChange(updateField(parameters, index, 'tag', e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" value={param.name} fullWidth variant="standard"
                      onChange={(e) => onChange(updateField(parameters, index, 'name', e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small" value={param.type} variant="standard"
                      onChange={(e) => handleTypeChange(index, e.target.value as typeof PARAM_TYPES[number])}
                    >
                      {PARAM_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {param.type === 'Analog' && (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <TextField size="small" label="Min" type="number" variant="standard"
                          value={param.v_min} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_min', Number(e.target.value)))}
                        />
                        <TextField size="small" label="Max" type="number" variant="standard"
                          value={param.v_max} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_max', Number(e.target.value)))}
                        />
                        <TextField size="small" label="Unit" variant="standard"
                          value={param.unit} sx={{ width: 50 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'unit', e.target.value))}
                        />
                      </Box>
                    )}
                    {param.type === 'DInt' && (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <TextField size="small" label="Min" type="number" variant="standard"
                          value={param.v_min} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_min', Number(e.target.value)))}
                        />
                        <TextField size="small" label="Max" type="number" variant="standard"
                          value={param.v_max} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_max', Number(e.target.value)))}
                        />
                      </Box>
                    )}
                    {param.type === 'Binary' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField size="small" label="State0" variant="standard"
                          value={param.v_state0} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_state0', e.target.value))}
                        />
                        <TextField size="small" label="State1" variant="standard"
                          value={param.v_state1} sx={{ width: 60 }}
                          onChange={(e) => onChange(updateField(parameters, index, 'v_state1', e.target.value))}
                        />
                      </Box>
                    )}
                    {param.type === 'StringParam' && (
                      <TextField size="small" label="Default" variant="standard"
                        value={param.v_default} sx={{ width: 120 }}
                        onChange={(e) => onChange(updateField(parameters, index, 'v_default', e.target.value))}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small" variant="standard"
                      value={param.tag_mapping?.protocol ?? ''}
                      displayEmpty
                      onChange={(e) => {
                        const protocol = e.target.value as ProtocolType
                        if (!protocol) {
                          onChange(updateTagMapping(parameters, index, null))
                        } else {
                          onChange(updateTagMapping(parameters, index, {
                            protocol,
                            address: param.tag_mapping?.address ?? ''
                          }))
                        }
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="OpcUa">OPC UA</MenuItem>
                      <MenuItem value="Modbus">Modbus</MenuItem>
                      <MenuItem value="Zenoh">Zenoh</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {param.tag_mapping && (
                      <TextField
                        size="small" variant="standard" placeholder="ns=2;s=..." fullWidth
                        value={param.tag_mapping.address}
                        onChange={(e) => onChange(updateTagMapping(parameters, index, {
                          ...param.tag_mapping!,
                          address: e.target.value
                        }))}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleDelete(index)}>
                      <Delete fontSize="small" />
                    </IconButton>
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

export default ParameterTable
