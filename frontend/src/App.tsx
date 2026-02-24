import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Snackbar, Alert } from '@mui/material'
import { useState } from 'react'
import { murphTheme } from './themes/murphTheme'
import Dashboard from './pages/Dashboard'
import Heptapod from './pages/Heptapod'
import PEALauncher from './pages/PEALauncher'
import HeptapodMesh from './pages/HeptapodMesh'
import MarsHabitat from './pages/MarsHabitat'
import './App.css'

function App() {
  const [error, setError] = useState<string | null>(null)

  return (
    <ThemeProvider theme={murphTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/heptapod" element={<Heptapod />} />
          <Route path="/pea-launcher" element={<PEALauncher />} />
          <Route path="/heptapod-mesh" element={<HeptapodMesh />} />
          <Route path="/mars-habitat" element={<MarsHabitat />} />
        </Routes>
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
