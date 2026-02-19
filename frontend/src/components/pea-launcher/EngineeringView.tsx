import React, { useState, useEffect } from 'react'
import {
  Box, Paper, Typography, TextField, Button, Accordion, AccordionSummary,
  AccordionDetails, List, ListItemButton, ListItemText, IconButton, Divider,
  Select, MenuItem, Snackbar, Alert
} from '@mui/material'
import { ExpandMore, Save, Add, Delete, FileDownload, FileUpload } from '@mui/icons-material'
import apiService from '../../services/apiService'
import { PeaConfig, createEmptyPeaConfig, createEmptyService } from '../../types/mtp'
import ServiceEditor from './ServiceEditor'
import ActiveElementEditor from './ActiveElementEditor'

const EngineeringView: React.FC = () => {
  const [peaList, setPeaList] = useState<PeaConfig[]>([])
  const [selectedPea, setSelectedPea] = useState<PeaConfig | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  useEffect(() => {
    loadPeaList()
  }, [])

  const loadPeaList = async () => {
    try {
      const peas = await apiService.listPeas()
      setPeaList(peas)
    } catch {
      setPeaList([])
    }
  }

  const handleNewPea = () => {
    setSelectedPea(createEmptyPeaConfig())
    setIsDirty(true)
  }

  const handleSelectPea = (pea: PeaConfig) => {
    setSelectedPea({ ...pea })
    setIsDirty(false)
  }

  const handleDeletePea = async (id: string) => {
    try {
      await apiService.deletePea(id)
      setPeaList(peaList.filter(p => p.id !== id))
      if (selectedPea?.id === id) {
        setSelectedPea(null)
        setIsDirty(false)
      }
      setSnackbar({ open: true, message: 'PEA deleted', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete PEA', severity: 'error' })
    }
  }

  const handleSave = async () => {
    if (!selectedPea) return
    try {
      let saved: PeaConfig
      if (selectedPea.id && peaList.some(p => p.id === selectedPea.id)) {
        saved = await apiService.updatePea(selectedPea.id, selectedPea)
      } else {
        saved = await apiService.createPea(selectedPea)
      }
      setSelectedPea(saved)
      setIsDirty(false)
      await loadPeaList()
      setSnackbar({ open: true, message: 'PEA configuration saved', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to save PEA configuration', severity: 'error' })
    }
  }

  const handleExport = () => {
    if (!selectedPea) return
    const blob = new Blob([JSON.stringify(selectedPea, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pea-${selectedPea.name || selectedPea.id || 'config'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target?.result as string) as PeaConfig
          config.id = ''
          setSelectedPea(config)
          setIsDirty(true)
          setSnackbar({ open: true, message: 'PEA configuration imported', severity: 'success' })
        } catch {
          setSnackbar({ open: true, message: 'Invalid JSON file', severity: 'error' })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const updatePea = (updates: Partial<PeaConfig>) => {
    if (!selectedPea) return
    setSelectedPea({ ...selectedPea, ...updates })
    setIsDirty(true)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
      {/* PEA List Sidebar */}
      <Paper sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>PEA Configurations</Typography>
          <IconButton size="small" color="primary" onClick={handleNewPea}><Add /></IconButton>
        </Box>
        <Divider />
        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {peaList.map((pea) => (
            <ListItemButton
              key={pea.id}
              selected={selectedPea?.id === pea.id}
              onClick={() => handleSelectPea(pea)}
            >
              <ListItemText
                primary={pea.name || 'Unnamed PEA'}
                secondary={`${pea.services.length} services | v${pea.version}`}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeletePea(pea.id) }}>
                <Delete fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
          {peaList.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              No PEAs configured. Click + to create one.
            </Typography>
          )}
        </List>
        <Divider />
        <Box sx={{ p: 1, display: 'flex', gap: 0.5 }}>
          <Button size="small" startIcon={<FileUpload />} onClick={handleImport} fullWidth>
            Import
          </Button>
        </Box>
      </Paper>

      {/* PEA Editor */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {selectedPea ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* PEA Information */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>PEA Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="PEA Name" size="small" value={selectedPea.name} fullWidth
                      onChange={(e) => updatePea({ name: e.target.value })} />
                    <TextField label="Version" size="small" value={selectedPea.version} sx={{ width: 120 }}
                      onChange={(e) => updatePea({ version: e.target.value })} />
                  </Box>
                  <TextField label="Description" size="small" value={selectedPea.description} fullWidth multiline rows={2}
                    onChange={(e) => updatePea({ description: e.target.value })} />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="Writer Name" size="small" value={selectedPea.writer.name} fullWidth
                      onChange={(e) => updatePea({ writer: { ...selectedPea.writer, name: e.target.value } })} />
                    <TextField label="Writer Vendor" size="small" value={selectedPea.writer.vendor} fullWidth
                      onChange={(e) => updatePea({ writer: { ...selectedPea.writer, vendor: e.target.value } })} />
                    <TextField label="Writer Version" size="small" value={selectedPea.writer.version} sx={{ width: 120 }}
                      onChange={(e) => updatePea({ writer: { ...selectedPea.writer, version: e.target.value } })} />
                  </Box>
                  {selectedPea.id && (
                    <Typography variant="caption" color="text.secondary">ID: {selectedPea.id}</Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* OPC UA Configuration */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>OPC UA Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField label="Endpoint URL" size="small" value={selectedPea.opcua_config.endpoint} fullWidth
                    helperText="e.g. opc.tcp://0.0.0.0:4840"
                    onChange={(e) => updatePea({ opcua_config: { ...selectedPea.opcua_config, endpoint: e.target.value } })} />
                  <TextField label="Namespace URI" size="small" value={selectedPea.opcua_config.namespace_uri} fullWidth
                    helperText="e.g. urn:fendtastic:pea:reactor-1"
                    onChange={(e) => updatePea({ opcua_config: { ...selectedPea.opcua_config, namespace_uri: e.target.value } })} />
                  <Select
                    value={selectedPea.opcua_config.security_policy}
                    size="small" fullWidth displayEmpty
                    onChange={(e) => updatePea({ opcua_config: { ...selectedPea.opcua_config, security_policy: e.target.value } })}
                  >
                    <MenuItem value="None">None</MenuItem>
                    <MenuItem value="Basic256">Basic256</MenuItem>
                    <MenuItem value="Basic256Sha256">Basic256Sha256</MenuItem>
                  </Select>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Services */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Services ({selectedPea.services.length})
                  </Typography>
                  <Button size="small" startIcon={<Add />} sx={{ ml: 'auto', mr: 2 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      updatePea({ services: [...selectedPea.services, createEmptyService()] })
                    }}>
                    Add Service
                  </Button>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {selectedPea.services.map((service, index) => (
                  <ServiceEditor
                    key={index}
                    service={service}
                    onChange={(updated) => {
                      const services = [...selectedPea.services]
                      services[index] = updated
                      updatePea({ services })
                    }}
                    onDelete={() => {
                      updatePea({ services: selectedPea.services.filter((_, i) => i !== index) })
                    }}
                  />
                ))}
                {selectedPea.services.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No services configured. Add a service to define the PEA's functionality.
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Active Elements */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Active Elements ({selectedPea.active_elements.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ActiveElementEditor
                  elements={selectedPea.active_elements}
                  onChange={(elements) => updatePea({ active_elements: elements })}
                />
              </AccordionDetails>
            </Accordion>

            {/* Action Bar */}
            <Paper sx={{ p: 1.5, display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
              <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={!isDirty}>
                Save PEA Configuration
              </Button>
              <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}
                disabled={!selectedPea.name}>
                Export JSON
              </Button>
              {isDirty && (
                <Typography variant="caption" color="warning.main" sx={{ ml: 'auto' }}>
                  Unsaved changes
                </Typography>
              )}
            </Paper>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a PEA configuration or create a new one
            </Typography>
          </Box>
        )}
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default EngineeringView
