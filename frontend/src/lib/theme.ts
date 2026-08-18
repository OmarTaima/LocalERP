"use client";

import { createTheme } from "@mui/material/styles";

const EN_FONT_FAMILY = '"Segoe UI", "Inter", Roboto, "Helvetica Neue", Arial, sans-serif';

export function createAppTheme(direction: "ltr" | "rtl") {
  const rtl = direction === "rtl";
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
      MuiStack: {
        defaultProps: { useFlexGap: true },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: "8px 18px",
          },
          ...(rtl
            ? {
                startIcon: { marginLeft: 8, marginRight: -4 },
                endIcon: { marginLeft: -4, marginRight: 8 },
              }
            : {}),
        },
        ...(rtl
          ? {
              variants: [
                {
                  props: { size: "small" },
                  style: {
                    "& .MuiButton-startIcon": { marginRight: -2 },
                    "& .MuiButton-endIcon": { marginLeft: -2 },
                  },
                },
              ],
            }
          : {}),
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
          root: {
            textAlign: "start",
          },
          head: {
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            fontSize: "0.72rem",
            letterSpacing: "0.05em",
            textAlign: "start",
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            textAlign: "start",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            textAlign: "start",
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            textAlign: "start",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            textAlign: "start",
            ...(rtl ? { paddingLeft: 14, paddingRight: 14 } : {}),
          },
          ...(rtl
            ? {
                input: {
                  "&.MuiInputBase-inputAdornedStart": { paddingLeft: 14, paddingRight: 0 },
                  "&.MuiInputBase-inputAdornedEnd": { paddingRight: 14, paddingLeft: 0 },
                },
                notchedOutline: {
                  textAlign: "right",
                },
              }
            : {}),
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: rtl
            ? {
                left: "auto",
                right: 0,
                transformOrigin: "top right",
                "&.MuiInputLabel-outlined": { transform: "translate(-14px, 14px) scale(1)" },
                "&.MuiInputLabel-outlined.MuiInputLabel-sizeSmall": { transform: "translate(-14px, 7px) scale(1)" },
                "&.MuiInputLabel-outlined.MuiInputLabel-shrink": { transform: "translate(-14px, -22px) scale(0.75)" },
                "&.MuiInputLabel-outlined.MuiInputLabel-shrink.MuiInputLabel-sizeSmall": {
                  transform: "translate(-14px, -9px) scale(0.75)",
                },
              }
            : {},
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: rtl
            ? {
                "&.MuiInputAdornment-positionStart": { marginRight: 0, marginLeft: 8 },
                "&.MuiInputAdornment-positionEnd": { marginLeft: 0, marginRight: 8 },
              }
            : {},
        },
      },
      MuiSelect: {
        styleOverrides: rtl
          ? {
              select: { paddingRight: 14, paddingLeft: 32 },
              icon: { right: "auto", left: 7 },
              iconOutlined: { right: "auto", left: 7 },
            }
          : {},
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            textAlign: "start",
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