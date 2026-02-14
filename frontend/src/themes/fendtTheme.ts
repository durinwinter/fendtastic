import { createTheme } from '@mui/material/styles'

export const fendtTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6EC72D', // Fendt Green
      light: '#8FD84F',
      dark: '#4E9020',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#E67E22', // Mars Orange
      light: '#F39C12',
      dark: '#D35400',
      contrastText: '#ffffff',
    },
    error: {
      main: '#E74C3C', // Mars Red
      light: '#EC7063',
      dark: '#C0392B',
    },
    warning: {
      main: '#F39C12',
      light: '#F8C471',
      dark: '#D68910',
    },
    info: {
      main: '#3498DB', // Mars Blue
      light: '#5DADE2',
      dark: '#2874A6',
    },
    success: {
      main: '#6EC72D',
      light: '#8FD84F',
      dark: '#4E9020',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.75rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#4E9020 #1a1a1a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 4,
            backgroundColor: '#4E9020',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1a1a1a',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          borderRadius: 8,
          border: '1px solid rgba(110, 199, 45, 0.1)',
        },
      },
    },
  },
})
