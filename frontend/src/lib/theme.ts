"use client";

import { createTheme } from "@mui/material/styles";

const EN_FONT_FAMILY = '"Segoe UI", "Inter", Roboto, "Helvetica Neue", Arial, sans-serif';

export function createAppTheme(direction: "ltr" | "rtl") {
  return createTheme({
    direction,
    palette: {
      mode: "light",
      primary: {
        main: "#4f46e5",
        light: "#818cf8",
        dark: "#4338ca",
      },
      secondary: {
        main: "#0f172a",
      },
      background: {
        default: "#f8fafc",
        paper: "#ffffff",
      },
      text: {
        primary: "#0f172a",
        secondary: "#64748b",
      },
      divider: "#e2e8f0",
      success: { main: "#059669" },
      warning: { main: "#d97706" },
      error: { main: "#dc2626" },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: direction === "rtl" ? "var(--font-cairo)" : EN_FONT_FAMILY,
      h4: {
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
      subtitle1: {
        fontWeight: 600,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: "8px 18px",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            fontSize: "0.72rem",
            letterSpacing: "0.05em",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
    },
  });
}