import React, { useState } from 'react'
import { Paper, Typography, Box, Grid, TextField, Button, List, ListItem, ListItemText, Divider, IconButton, MenuItem, Select } from '@mui/material'
import { Add, Delete, Save } from '@mui/icons-material'
import zenohService from '../../services/zenohService'

interface TagMapping {
    id: string
    tagName: string
    mtpObject: string
    dataType: string
}

const EngineeringView: React.FC = () => {
    const [mappings, setMappings] = useState<TagMapping[]>([
        { id: '1', tagName: 'DB10.Temperature', mtpObject: 'AnaView_1.V', dataType: 'REAL' },
        { id: '2', tagName: 'DB10.ValveStatus', mtpObject: 'BinMon_1.V', dataType: 'BOOL' }
    ])
    const [newTag, setNewTag] = useState('')
    const [newMtpObject, setNewMtpObject] = useState('')
    const [newDataType, setNewDataType] = useState('REAL')

    const handleAddMapping = () => {
        if (newTag && newMtpObject) {
            const newMapping: TagMapping = {
                id: Date.now().toString(),
                tagName: newTag,
                mtpObject: newMtpObject,
                dataType: newDataType
            }
            setMappings([...mappings, newMapping])
            setNewTag('')
            setNewMtpObject('')
        }
    }

    const handleDeleteMapping = (id: string) => {
        setMappings(mappings.filter(m => m.id !== id))
    }

    const handleSave = () => {
        zenohService.publish('pea-launcher/config/tags', mappings)
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Tag Mapping Configuration</Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={3}>
                        <TextField
                            label="PLC Tag"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            fullWidth size="small"
                        />
                    </Grid>
                    <Grid item xs={3}>
                        <TextField
                            label="MTP Data Assembly"
                            value={newMtpObject}
                            onChange={(e) => setNewMtpObject(e.target.value)}
                            fullWidth size="small"
                        />
                    </Grid>
                    <Grid item xs={3}>
                        <Select
                            value={newDataType}
                            onChange={(e) => setNewDataType(e.target.value as string)}
                            fullWidth size="small"
                        >
                            <MenuItem value="REAL">REAL</MenuItem>
                            <MenuItem value="BOOL">BOOL</MenuItem>
                            <MenuItem value="INT">INT</MenuItem>
                            <MenuItem value="STRING">STRING</MenuItem>
                        </Select>
                    </Grid>
                    <Grid item xs={3}>
                        <Button variant="contained" startIcon={<Add />} onClick={handleAddMapping} fullWidth>
                            Add Mapping
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">Current Mappings</Typography>
                    <Button variant="outlined" startIcon={<Save />} onClick={handleSave}>
                        Save Configuration
                    </Button>
                </Box>
                <List>
                    {mappings.map((mapping) => (
                        <React.Fragment key={mapping.id}>
                            <ListItem
                                secondaryAction={
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteMapping(mapping.id)}>
                                        <Delete />
                                    </IconButton>
                                }
                            >
                                <ListItemText
                                    primary={`${mapping.tagName} -> ${mapping.mtpObject}`}
                                    secondary={`Type: ${mapping.dataType}`}
                                />
                            </ListItem>
                            <Divider />
                        </React.Fragment>
                    ))}
                </List>
            </Paper>
        </Box>
    )
}

export default EngineeringView
