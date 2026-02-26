import { createTheme } from '@mui/material/styles'

// Identidad Corporativa: Ilustre Municipalidad de Cabo de Hornos
export const CORPORATE_COLORS = {
  primaryBlue: '#0071BC',
  primaryBlueDark: '#005a96',
  primaryBlueLight: '#3391cc',
  textGray: '#4D4D4D',
  // Barra característica (orden izquierda a derecha)
  barYellowGreen: '#2DC700',
  barGreen: '#8AC53E',
  barMagenta: '#EB1B78',
  barLightBlue: '#28A9E3',
  barOrange: '#EE5825',
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#0071BC',
      light: '#3391cc',
      dark: '#005a96',
    },
    secondary: {
      main: '#8AC53E',
      light: '#a3d466',
      dark: '#6a9a2f',
    },
    text: {
      primary: '#4D4D4D',
      secondary: '#666666',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#EE5825',
    },
    info: {
      main: '#28A9E3',
    },
    success: {
      main: '#2DC700',
    },
  },
  typography: {
    fontFamily: '"Montserrat", "Helvetica", "Arial", sans-serif',
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
          fontWeight: 600,
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
