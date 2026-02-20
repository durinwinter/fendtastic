import React, { useState, useEffect, useCallback } from 'react'
import {
    Paper, Typography, Button, Box, TextField, List, ListItem,
    ListItemText, ListItemSecondaryAction, IconButton, Alert, Chip
} from '@mui/material'
import { PlayArrow, Delete } from '@mui/icons-material'
import apiService from '../../services/apiService'
import { Recipe } from '../../types/recipe'

const RecipeManager: React.FC = () => {
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [newName, setNewName] = useState('')
    const [executing, setExecuting] = useState<string | null>(null)

    const loadRecipes = useCallback(async () => {
        try {
            const list = await apiService.listRecipes()
            setRecipes(list)
        } catch (e) {
            console.error('Failed to load recipes:', e)
        }
    }, [])

    useEffect(() => { loadRecipes() }, [loadRecipes])

    const handleCreate = async () => {
        if (!newName.trim()) return
        try {
            const recipe = await apiService.createRecipe({
                id: '',
                name: newName.trim(),
                description: '',
                steps: [],
                created_at: new Date().toISOString(),
            })
            setRecipes(prev => [...prev, recipe])
            setNewName('')
        } catch (e) {
            console.error('Failed to create recipe:', e)
        }
    }

    const handleExecute = async (id: string) => {
        setExecuting(id)
        try {
            await apiService.executeRecipe(id)
        } catch (e) {
            console.error('Failed to execute recipe:', e)
        } finally {
            setTimeout(() => setExecuting(null), 2000)
        }
    }

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
                Recipe Management
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    label="New Recipe Name"
                    variant="outlined"
                    size="small"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    fullWidth
                />
                <Button variant="contained" onClick={handleCreate} disabled={!newName.trim()}>
                    Create
                </Button>
            </Box>

            {recipes.length === 0 ? (
                <Alert severity="info">No recipes yet. Create one above.</Alert>
            ) : (
                <List sx={{ flex: 1, overflow: 'auto' }} disablePadding>
                    {recipes.map(recipe => (
                        <ListItem key={recipe.id} divider sx={{ pr: 10 }}>
                            <ListItemText
                                primary={recipe.name}
                                secondary={`${recipe.steps.length} steps — ${recipe.id.slice(0, 8)}`}
                            />
                            {executing === recipe.id && (
                                <Chip label="EXECUTING" color="success" size="small" sx={{ mr: 1 }} />
                            )}
                            <ListItemSecondaryAction>
                                <IconButton
                                    edge="end"
                                    color="success"
                                    onClick={() => handleExecute(recipe.id)}
                                    disabled={executing !== null}
                                >
                                    <PlayArrow />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    )
}

export default RecipeManager
