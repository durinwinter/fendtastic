import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Snackbar, Alert } from '@mui/material'
import React, { useState, useEffect } from 'react'
import { fendtTheme } from './themes/fendtTheme'
import Dashboard from './pages/Dashboard'
import Heptapod from './pages/Heptapod'
import PEALauncher from './pages/PEALauncher'
import HeptapodMesh from './pages/HeptapodMesh'
import './App.css'

function App() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleNetworkError = (event: any) => {
      setError(event.detail.message)
    }
    window.addEventListener('api-network-error', handleNetworkError)
    return () => window.removeEventListener('api-network-error', handleNetworkError)
  }, [])

  return (
    <ThemeProvider theme={fendtTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/heptapod" element={<Heptapod />} />
          <Route path="/pea-launcher" element={<PEALauncher />} />
          <Route path="/heptapod-mesh" element={<HeptapodMesh />} />
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
