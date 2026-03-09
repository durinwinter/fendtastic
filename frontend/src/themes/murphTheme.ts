import { alpha, createTheme } from '@mui/material/styles'

const entLinework =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 120'%3E%3Cg fill='none' stroke='%23140d0a' stroke-opacity='.7' stroke-linecap='round'%3E%3Cpath d='M-8 18C24 20 42 29 69 26C94 23 115 14 144 16C171 18 193 30 221 27C248 24 269 12 329 18' stroke-width='3.2'/%3E%3Cpath d='M-10 40C28 43 48 55 78 52C106 49 124 37 155 39C186 41 210 56 237 54C263 52 281 41 330 43' stroke-width='2.8'/%3E%3Cpath d='M-14 64C22 67 44 79 72 76C102 73 121 59 152 61C184 63 203 79 233 78C264 77 285 64 332 67' stroke-width='3.6'/%3E%3Cpath d='M-12 90C26 92 46 103 74 100C103 97 126 86 160 87C192 88 215 101 244 100C273 99 292 90 334 92' stroke-width='3'/%3E%3Cpath d='M44 22C41 32 39 42 37 54' stroke-width='1.5'/%3E%3Cpath d='M128 37C126 46 123 54 118 62' stroke-width='1.5'/%3E%3Cpath d='M214 25C211 36 210 48 210 59' stroke-width='1.5'/%3E%3Cpath d='M267 78C265 89 263 98 259 108' stroke-width='1.4'/%3E%3C/g%3E%3C/svg%3E")`

const entLineworkSoft =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 120'%3E%3Cg fill='none' stroke='%23f6d38a' stroke-opacity='.11' stroke-linecap='round'%3E%3Cpath d='M-10 20C18 17 42 26 71 24C95 22 117 14 145 16C172 18 190 27 219 25C245 23 270 14 330 17' stroke-width='1.2'/%3E%3Cpath d='M-12 64C24 61 45 74 74 72C101 70 120 58 152 61C182 64 200 76 233 75C262 74 286 63 332 65' stroke-width='1.1'/%3E%3Cpath d='M-8 94C26 90 48 102 77 100C107 98 126 87 160 88C194 89 214 103 244 101C273 99 293 91 334 93' stroke-width='1.15'/%3E%3C/g%3E%3C/svg%3E")`

const carvedSurface = (top: string, bottom: string) => ({
  backgroundColor: bottom,
  backgroundImage: `radial-gradient(circle at 12% 10%, rgba(110,139,74,0.08), transparent 18%), radial-gradient(circle at 84% 8%, rgba(110,139,74,0.06), transparent 16%), linear-gradient(180deg, ${top}, ${bottom}), ${entLineworkSoft}, ${entLinework}`,
  backgroundSize: 'auto, auto, auto, 320px 120px, 320px 120px',
  backgroundPosition: '0 0, 0 0, 0 0, 0 0, 0 0',
})

export const murphTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#b9874b',
      light: '#d5a66b',
      dark: '#7f5633',
      contrastText: '#f8efdf',
    },
    secondary: {
      main: '#f0c36a',
      light: '#ffdf8d',
      dark: '#bb8450',
      contrastText: '#140d0a',
    },
    error: {
      main: '#c3623d',
      light: '#d9815f',
      dark: '#8b3f26',
    },
    warning: {
      main: '#f0c36a',
      light: '#ffdf8d',
      dark: '#bb8450',
    },
    info: {
      main: '#769493',
      light: '#8ca9a8',
      dark: '#4c6968',
    },
    success: {
      main: '#6e8b4a',
      light: '#8daa61',
      dark: '#41532a',
    },
    background: {
      default: '#090604',
      paper: '#1a120c',
    },
    text: {
      primary: '#f5e9cf',
      secondary: '#cbbca2',
    },
    divider: alpha('#f0c36a', 0.12),
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    h1: { fontSize: '2.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' },
    h2: { fontSize: '2.1rem', fontWeight: 700, letterSpacing: '0.04em' },
    h3: { fontSize: '1.55rem', fontWeight: 700, letterSpacing: '0.03em' },
    h4: { fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.03em' },
    h5: { fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.03em' },
    h6: { fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.82rem', lineHeight: 1.5 },
    button: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    caption: {
      fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--ent-bg-0': '#090604',
          '--ent-bg-1': '#130d09',
          '--ent-bg-2': '#1d140e',
          '--ent-bark-dark': '#23160f',
          '--ent-bark-mid': '#4b3120',
          '--ent-wood-mid': '#7f5633',
          '--ent-wood-light': '#bb8450',
          '--ent-forge': '#f0c36a',
          '--ent-forge-hot': '#ffdf8d',
          '--ent-moss': '#6e8b4a',
          '--ent-ember': '#c3623d',
          '--ent-linework': entLinework,
          '--ent-linework-soft': entLineworkSoft,
          '--ent-panel-surface':
            'linear-gradient(180deg, rgba(63,42,26,0.94), rgba(22,15,11,0.98))',
          '--ent-shell-surface':
            'linear-gradient(180deg, rgba(49,33,22,0.92), rgba(18,12,9,0.96))',
          '--ent-well-surface':
            'linear-gradient(180deg, rgba(18,12,9,0.72), rgba(39,26,17,0.78))',
          '--ent-canopy-glow':
            'radial-gradient(circle at 12% 10%, rgba(110,139,74,0.08), transparent 18%), radial-gradient(circle at 84% 8%, rgba(110,139,74,0.06), transparent 16%)',
        },
        'html, body, #root': {
          minHeight: '100%',
        },
        body: {
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#090604',
          backgroundImage:
            'radial-gradient(circle at 12% 0%, rgba(110,139,74,0.16), transparent 16%), radial-gradient(circle at 88% 4%, rgba(110,139,74,0.1), transparent 14%), radial-gradient(circle at top, rgba(240,195,106,0.09), transparent 30%), linear-gradient(180deg, #090604, #130d09 40%, #070504 100%)',
          color: '#f5e9cf',
          scrollbarColor: '#b9874b #130d09',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 999,
            backgroundColor: '#7f5633',
            border: '1px solid rgba(240,195,106,0.16)',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: '#130d09',
          },
        },
        code: {
          fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          ...carvedSurface('rgba(63,42,26,0.94)', 'rgba(22,15,11,0.98)'),
          borderRadius: 24,
          border: '1px solid rgba(240,195,106,0.14)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -20px 30px rgba(0,0,0,0.16), 0 16px 26px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...carvedSurface('rgba(63,42,26,0.94)', 'rgba(22,15,11,0.98)'),
          borderRadius: 24,
          border: '1px solid rgba(240,195,106,0.14)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -20px 30px rgba(0,0,0,0.16), 0 16px 26px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          ...carvedSurface('rgba(39,26,18,0.96)', 'rgba(13,9,7,0.98)'),
          borderBottom: '1px solid rgba(240,195,106,0.16)',
          boxShadow: '0 14px 32px rgba(0,0,0,0.24)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '18px 14px 20px 14px',
          padding: '12px 54px 12px 16px',
          color: '#f5e9cf',
          border: '1px solid rgba(240,195,106,0.18)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -12px 18px rgba(45,29,18,0.34), 0 10px 20px rgba(0,0,0,0.18)',
          backgroundImage: `radial-gradient(circle at 12% 12%, rgba(110,139,74,0.12), transparent 20%), linear-gradient(180deg, rgba(131,89,54,0.92), rgba(72,46,27,0.98)), ${entLineworkSoft}, ${entLinework}`,
          backgroundSize: 'auto, auto, 240px 90px, 240px 90px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0',
          justifyContent: 'flex-start',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage:
              `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 44'%3E%3Cg fill='none' stroke='%23120b08' stroke-opacity='.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 34C26 34 33 28 44 28C56 28 61 17 74 17C88 17 94 28 109 28' stroke-width='2.4'/%3E%3Cpath d='M43 28C39 22 35 17 30 12' stroke-width='1.5'/%3E%3Cpath d='M59 24C62 18 68 12 77 9' stroke-width='1.4'/%3E%3Cpath d='M74 17C83 14 89 14 96 17' stroke-width='1.4'/%3E%3Cpath d='M20 34C23 29 25 24 27 18' stroke-width='1.2'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            backgroundSize: '98px 36px',
            opacity: 0.56,
            mixBlendMode: 'screen',
          },
          '&:hover': {
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(240,195,106,0.14), 0 10px 24px rgba(0,0,0,0.26), 0 0 20px rgba(240,195,106,0.08)',
            filter: 'brightness(1.05)',
          },
        },
        outlined: {
          backgroundImage: `radial-gradient(circle at 14% 12%, rgba(110,139,74,0.1), transparent 18%), linear-gradient(180deg, rgba(51,36,25,0.98), rgba(26,18,13,0.98)), ${entLineworkSoft}, ${entLinework}`,
          borderColor: 'rgba(110,139,74,0.2)',
        },
        containedPrimary: {
          backgroundImage: `radial-gradient(circle at 12% 12%, rgba(110,139,74,0.12), transparent 20%), linear-gradient(180deg, rgba(127,86,51,0.96), rgba(81,52,31,0.98)), ${entLineworkSoft}, ${entLinework}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          border: '1px solid rgba(240,195,106,0.16)',
          backgroundImage: `radial-gradient(circle at 14% 12%, rgba(110,139,74,0.1), transparent 18%), linear-gradient(180deg, rgba(49,33,22,0.92), rgba(18,12,9,0.96)), ${entLineworkSoft}, ${entLinework}`,
          backgroundSize: 'auto, auto, 240px 90px, 240px 90px',
          color: '#f5e9cf',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          ...carvedSurface('rgba(18,12,9,0.72)', 'rgba(39,26,17,0.78)'),
          borderRadius: 18,
          boxShadow: 'inset 0 10px 18px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
          '& fieldset': {
            borderColor: 'rgba(240,195,106,0.1)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(240,195,106,0.22)',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#f0c36a',
            boxShadow: `0 0 0 1px ${alpha('#f0c36a', 0.18)}`,
          },
        },
        input: {
          color: '#f5e9cf',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#cbbca2',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontSize: '0.75rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: '1px solid rgba(240,195,106,0.14)',
          backgroundImage: `linear-gradient(180deg, rgba(43,29,20,0.96), rgba(20,14,10,0.98)), ${entLineworkSoft}, ${entLinework}`,
          backgroundSize: 'auto, 240px 90px, 240px 90px',
        },
      },
    },
  },
})
