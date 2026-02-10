import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#48bb78',
      light: '#68d391',
      dark: '#38a169',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    info: {
      main: '#3b82f6',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      '@media (min-width:600px)': {
        fontSize: '1.75rem',
      },
      '@media (min-width:900px)': {
        fontSize: '2.125rem',
      },
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
      '@media (min-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.1rem',
      '@media (min-width:600px)': {
        fontSize: '1.25rem',
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          '@media (pointer: coarse)': {
            minHeight: 44,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (pointer: coarse)': {
            minHeight: 44,
            minWidth: 44,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          flexWrap: 'wrap',
          justifyContent: 'center',
        },
        selectLabel: {
          '@media (max-width:599px)': {
            display: 'none',
          },
        },
        input: {
          '@media (max-width:599px)': {
            marginRight: 8,
          },
        },
      },
    },
  },
})

export default theme
