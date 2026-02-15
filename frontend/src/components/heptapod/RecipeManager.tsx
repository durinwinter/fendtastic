import React, { useState } from 'react'
import { Paper, Typography, Button, Box, TextField } from '@mui/material'
import zenohService from '../../services/zenohService'

const RecipeManager: React.FC = () => {
    const [recipeName, setRecipeName] = useState('')

    const handleLoadRecipe = () => {
        if (recipeName) {
            zenohService.publish('heptapod/recipes/command', { command: 'load', recipe: recipeName })
        }
    }

    const handleStartRecipe = () => {
        zenohService.publish('heptapod/recipes/command', { command: 'start' })
    }

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Recipe Management
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <TextField
                    label="Recipe Name"
                    variant="outlined"
                    size="small"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    fullWidth
                />
                <Button variant="contained" onClick={handleLoadRecipe}>
                    Load
                </Button>
            </Box>
            <Box sx={{ mt: 2 }}>
                <Button variant="contained" color="success" fullWidth onClick={handleStartRecipe} size="large">
                    START PRODUCTION
                </Button>
            </Box>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Current Recipe Status:
                </Typography>
                <Typography variant="body1">
                    No recipe loaded.
                </Typography>
            </Box>
        </Paper>
    )
}

export default RecipeManager
