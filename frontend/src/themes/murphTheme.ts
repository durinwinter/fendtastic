import { createTheme } from '@mui/material/styles'

export const murphTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#B7410E', // Deep Mars Rust
            light: '#D35400',
            dark: '#8E320A',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#FFBF00', // Terminal Amber
            light: '#FFD700',
            dark: '#C79A00',
            contrastText: '#000000',
        },
        error: {
            main: '#E74C3C', // Mars Red
            light: '#EC7063',
            dark: '#C0392B',
        },
        warning: {
            main: '#FFBF00',
            light: '#FFD700',
            dark: '#C79A00',
        },
        info: {
            main: '#00D1FF', // Oxygen Blue
            light: '#33DAFF',
            dark: '#00A6CC',
        },
        success: {
            main: '#2ECC71',
            light: '#58D68D',
            dark: '#239B56',
        },
        background: {
            default: '#0B0B0B',
            paper: '#121212',
        },
        text: {
            primary: '#ffffff',
            secondary: '#b0b0b0',
        },
    },
    typography: {
        fontFamily: '"Rajdhani", "JetBrains Mono", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontSize: '2.5rem', fontWeight: 600 },
        h2: { fontSize: '2rem', fontWeight: 600 },
        h3: { fontSize: '1.75rem', fontWeight: 500 },
        h4: { fontSize: '1.5rem', fontWeight: 500 },
        h5: { fontSize: '1.25rem', fontWeight: 500 },
        h6: { fontSize: '1rem', fontWeight: 500 },
        body1: { fontSize: '0.875rem' },
        body2: { fontSize: '0.75rem' },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                ':root': {
                    '--murph-rust': '#B7410E',
                    '--murph-rust-dark': '#8E320A',
                    '--murph-rust-light': '#D35400',
                    '--murph-iron': '#121212',
                },
                body: {
                    margin: 0,
                    minHeight: '100vh',
                    backgroundColor: '#0B0B0B',
                    backgroundImage: 'none',
                    scrollbarColor: '#B7410E #121212',
                    '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                        width: 6,
                        height: 6,
                    },
                    '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                        borderRadius: 0,
                        backgroundColor: '#B7410E',
                    },
                    '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
                        backgroundColor: '#0B0B0B',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#121212',
                    borderRadius: 4,
                    border: '1px solid #2A2A2A',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#121212',
                    borderRadius: 4,
                    border: '1px solid #2A2A2A',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#0B0B0B',
                    backgroundImage: 'none',
                    borderBottom: '1px solid #B7410E',
                    boxShadow: 'none',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                },
                containedPrimary: {
                    backgroundColor: '#B7410E',
                    '&:hover': {
                        backgroundColor: '#D35400',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 2,
                    fontWeight: 600,
                },
            },
        },
    },
})
