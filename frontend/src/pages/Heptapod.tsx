import React from 'react'
import { Box, Grid, Typography } from '@mui/material'
import Header from '../components/Header'
import ModuleList from '../components/heptapod/ModuleList'
import RecipeManager from '../components/heptapod/RecipeManager'

const Heptapod: React.FC = () => {
    return (
        <Box sx={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.default',
            overflow: 'hidden'
        }}>
            <Header />

            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                <Typography variant="h4" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}>
                    Heptapod Integration
                </Typography>

                <Grid container spacing={3} sx={{ height: 'calc(100% - 60px)' }}>
                    <Grid item xs={12} md={8}>
                        <ModuleList />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <RecipeManager />
                    </Grid>
                </Grid>
            </Box>
        </Box>
    )
}

export default Heptapod
