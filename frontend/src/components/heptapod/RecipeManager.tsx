import React, { useState, useEffect, useCallback } from 'react'
import {
  Paper, Typography, Button, Box, TextField, List, ListItem,
  ListItemText, IconButton, Alert, Chip, Divider, Select, MenuItem
} from '@mui/material'
import { PlayArrow, Delete, Add, Save } from '@mui/icons-material'
import apiService from '../../services/apiService'
import zenohService from '../../services/zenohService'
import { Recipe, RecipeStep } from '../../types/recipe'
import { ServiceCommand, ServiceState, ZENOH_TOPICS } from '../../types/mtp'

type RecipeExecution = {
  execution_id: string
  recipe_id: string
  recipe_name: string
  current_step: number
  total_steps: number
  step_statuses: string[]
  state: 'running' | 'completed' | 'failed' | 'aborted' | 'pending'
  started_at: string
  updated_at: string
}

type DiscoveredPea = {
  id: string
  name: string
  services: Array<{ tag: string; name: string }>
}

const emptyRecipe = (): Recipe => ({
  id: '',
  name: '',
  description: '',
  steps: [],
  created_at: new Date().toISOString(),
})

const newStep = (order: number): RecipeStep => ({
  order,
  pea_id: '',
  service_tag: '',
  command: ServiceCommand.Start,
  procedure_id: null,
  parameters: [],
  wait_for_state: null,
  timeout_ms: 30000,
})

const RecipeManager: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [peas, setPeas] = useState<DiscoveredPea[]>([])
  const [executions, setExecutions] = useState<RecipeExecution[]>([])
  const [selected, setSelected] = useState<Recipe>(emptyRecipe())
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)

  const loadRecipes = useCallback(async () => {
    try {
      const list = await apiService.listRecipes()
      setRecipes(list)
      if (!selected.id && list.length > 0) setSelected(list[0])
    } catch (e) {
      console.error('Failed to load recipes:', e)
    }
  }, [selected.id])

  const loadExecutions = useCallback(async () => {
    try {
      const list = await apiService.listRecipeExecutions()
      setExecutions(list)
    } catch (e) {
      console.error('Failed to load recipe executions:', e)
    }
  }, [])

  useEffect(() => { loadRecipes(); loadExecutions() }, [loadRecipes, loadExecutions])
  useEffect(() => {
    const t = setInterval(loadExecutions, 2000)
    return () => clearInterval(t)
  }, [loadExecutions])

  // First POL migration step: use discovered PEAs from UNS topics instead of local PEA config API.
  useEffect(() => {
    const upsertPea = (payload: any) => {
      if (!payload || !payload.pea_id) return
      setPeas(prev => {
        const map = new Map(prev.map(p => [p.id, p]))
        const existing = map.get(payload.pea_id)

        const services = Array.isArray(payload.services)
          ? payload.services
            .map((svc: any) => ({
              tag: String(svc?.tag ?? '').trim(),
              name: String(svc?.name ?? svc?.tag ?? '').trim(),
            }))
            .filter((svc: { tag: string; name: string }) => svc.tag.length > 0)
          : []

        map.set(payload.pea_id, {
          id: payload.pea_id,
          name: payload.name || existing?.name || payload.pea_id,
          services: services.length > 0 ? services : (existing?.services ?? []),
        })
        return Array.from(map.values())
      })
    }

    const unsubscribeAnnounce = zenohService.subscribe(
      ZENOH_TOPICS.peaDiscoveryWildcard,
      upsertPea
    )
    const unsubscribeStatus = zenohService.subscribe(
      ZENOH_TOPICS.peaStatusWildcard,
      upsertPea
    )
    return () => {
      unsubscribeAnnounce()
      unsubscribeStatus()
    }
  }, [])

  const handleSelectRecipe = (recipe: Recipe) => setSelected({ ...recipe })

  const handleCreateRecipe = () => {
    const recipe = emptyRecipe()
    setSelected(recipe)
  }

  const handleSave = async () => {
    if (!selected.name.trim()) return
    setSaving(true)
    try {
      if (selected.id) {
        await apiService.updateRecipe(selected.id, selected)
      } else {
        const created = await apiService.createRecipe(selected)
        setSelected(created)
      }
      await loadRecipes()
    } catch (e) {
      console.error('Failed to save recipe:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteRecipe(id)
      await loadRecipes()
      if (selected.id === id) setSelected(emptyRecipe())
    } catch (e) {
      console.error('Failed to delete recipe:', e)
    }
  }

  const handleExecute = async () => {
    if (!selected.id) return
    setExecuting(true)
    try {
      await apiService.executeRecipe(selected.id)
      setTimeout(loadExecutions, 800)
    } catch (e) {
      console.error('Failed to execute recipe:', e)
    } finally {
      setExecuting(false)
    }
  }

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    const steps = [...selected.steps]
    steps[index] = { ...steps[index], ...updates }
    setSelected({ ...selected, steps })
  }

  const selectedRecipeExecutions = executions
    .filter(x => x.recipe_id === selected.id)
    .sort((a, b) => (b.updated_at || b.started_at).localeCompare(a.updated_at || a.started_at))
    .slice(0, 3)

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Recipe Management</Typography>
        <Button size="small" startIcon={<Add />} onClick={handleCreateRecipe}>New</Button>
      </Box>

      <List dense sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        {recipes.map(recipe => (
          <ListItem key={recipe.id}
            secondaryAction={
              <IconButton edge="end" onClick={() => handleDelete(recipe.id)} size="small"><Delete /></IconButton>
            }
            sx={{ cursor: 'pointer', bgcolor: selected.id === recipe.id ? 'action.selected' : undefined }}
            onClick={() => handleSelectRecipe(recipe)}
          >
            <ListItemText primary={recipe.name} secondary={`${recipe.steps.length} step(s)`} />
          </ListItem>
        ))}
      </List>

      <Divider />

      <TextField
        label="Recipe Name"
        size="small"
        value={selected.name}
        onChange={(e) => setSelected({ ...selected, name: e.target.value })}
        fullWidth
      />
      <TextField
        label="Description"
        size="small"
        value={selected.description}
        onChange={(e) => setSelected({ ...selected, description: e.target.value })}
        multiline
        rows={2}
        fullWidth
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="subtitle2">Steps ({selected.steps.length})</Typography>
        <Button size="small" startIcon={<Add />} onClick={() => setSelected({
          ...selected,
          steps: [...selected.steps, newStep(selected.steps.length + 1)],
        })}>Add Step</Button>
      </Box>

      {selected.steps.length === 0 ? (
        <Alert severity="info">Add steps to define orchestration behavior.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {selected.steps.map((step, idx) => {
            const pea = peas.find(p => p.id === step.pea_id)
            const services = pea?.services ?? []
            return (
              <Box key={idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    type="number"
                    label="Order"
                    value={step.order}
                    onChange={(e) => updateStep(idx, { order: Number(e.target.value) })}
                    sx={{ width: 80 }}
                  />
                  <Select
                    size="small"
                    displayEmpty
                    value={step.pea_id}
                    onChange={(e) => updateStep(idx, { pea_id: String(e.target.value), service_tag: '' })}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="">PEA</MenuItem>
                    {peas.map(p => <MenuItem key={p.id} value={p.id}>{p.name || p.id}</MenuItem>)}
                  </Select>
                  <Select
                    size="small"
                    displayEmpty
                    value={step.service_tag}
                    onChange={(e) => updateStep(idx, { service_tag: String(e.target.value) })}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="">Service</MenuItem>
                    {services.map(s => <MenuItem key={s.tag} value={s.tag}>{s.name || s.tag}</MenuItem>)}
                  </Select>
                  <Select
                    size="small"
                    value={step.command}
                    onChange={(e) => updateStep(idx, { command: e.target.value as ServiceCommand })}
                    sx={{ minWidth: 120 }}
                  >
                    {Object.values(ServiceCommand).map(cmd => <MenuItem key={cmd} value={cmd}>{cmd}</MenuItem>)}
                  </Select>
                  <TextField
                    size="small"
                    type="number"
                    label="Procedure"
                    value={step.procedure_id ?? ''}
                    onChange={(e) => updateStep(idx, { procedure_id: e.target.value === '' ? null : Number(e.target.value) })}
                    sx={{ width: 95 }}
                  />
                  <Select
                    size="small"
                    displayEmpty
                    value={step.wait_for_state ?? ''}
                    onChange={(e) => updateStep(idx, { wait_for_state: e.target.value === '' ? null : (e.target.value as ServiceState) })}
                    sx={{ minWidth: 130 }}
                  >
                    <MenuItem value="">No Wait</MenuItem>
                    {Object.values(ServiceState).map(st => <MenuItem key={st} value={st}>{st}</MenuItem>)}
                  </Select>
                  <TextField
                    size="small"
                    type="number"
                    label="Timeout ms"
                    value={step.timeout_ms ?? ''}
                    onChange={(e) => updateStep(idx, { timeout_ms: e.target.value === '' ? null : Number(e.target.value) })}
                    sx={{ width: 110 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setSelected({
                      ...selected,
                      steps: selected.steps.filter((_, i) => i !== idx),
                    })}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving || !selected.name.trim()}>
          Save
        </Button>
        <Button variant="outlined" color="success" startIcon={<PlayArrow />}
          onClick={handleExecute}
          disabled={executing || !selected.id || selected.steps.length === 0}>
          Execute
        </Button>
      </Box>

      {selectedRecipeExecutions.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2">Recent Executions</Typography>
          <List dense>
            {selectedRecipeExecutions.map(exe => (
              <ListItem key={exe.execution_id} sx={{ px: 0 }}>
                <ListItemText
                  primary={`Step ${exe.current_step}/${exe.total_steps}`}
                  secondary={new Date(exe.updated_at || exe.started_at).toLocaleString()}
                />
                <Chip
                  size="small"
                  label={exe.state.toUpperCase()}
                  color={exe.state === 'completed' ? 'success' : exe.state === 'failed' ? 'error' : 'warning'}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  )
}

export default RecipeManager
