import { Suspense, lazy, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Snackbar, Alert, Box, CircularProgress } from '@mui/material'
import { murphTheme } from './themes/murphTheme'
import './App.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Heptapod = lazy(() => import('./pages/Heptapod'))
const PEALauncher = lazy(() => import('./pages/PEALauncher'))
const HeptapodMesh = lazy(() => import('./pages/HeptapodMesh'))
const MarsHabitat = lazy(() => import('./pages/MarsHabitat'))

function App() {
  const [error, setError] = useState<string | null>(null)

  return (
    <ThemeProvider theme={murphTheme}>
      <CssBaseline />
      <Router>
        <Suspense
          fallback={(
            <Box
              sx={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle at top left, rgba(155,74,33,0.22), transparent 35%), linear-gradient(180deg, #1f130d 0%, #120c09 100%)',
              }}
            >
              <CircularProgress color="primary" />
            </Box>
          )}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/heptapod" element={<Heptapod />} />
            <Route path="/pea-launcher" element={<PEALauncher />} />
            <Route path="/heptapod-mesh" element={<HeptapodMesh />} />
            <Route path="/mars-habitat" element={<MarsHabitat />} />
          </Routes>
        </Suspense>
      </Router>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  )
}

export default App
