import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { fendtTheme } from './themes/fendtTheme'
import Dashboard from './pages/Dashboard'
import Heptapod from './pages/Heptapod'
import PEALauncher from './pages/PEALauncher'
import zenohService from './services/zenohService'
import './App.css'

function App() {
  useEffect(() => {
    zenohService.connect().catch(console.error)
  }, [])

  return (
    <ThemeProvider theme={fendtTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/heptapod" element={<Heptapod />} />
          <Route path="/pea-launcher" element={<PEALauncher />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
