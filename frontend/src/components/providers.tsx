"use client";

import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createAppTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { CompanySettingsProvider } from "@/lib/company-settings";
import { LocaleProvider, useAppLocale, type Locale } from "@/lib/locale";
import { RtlCacheProvider } from "@/lib/emotion-cache";

function AppProviders({ children }: { children: React.ReactNode }) {
  const { locale } = useAppLocale();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const theme = useMemo(() => createAppTheme(direction), [direction]);

  return (
    <RtlCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <CompanySettingsProvider>{children}</CompanySettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </RtlCacheProvider>
  );
}

export function Providers({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <AppProviders>{children}</AppProviders>
    </LocaleProvider>
  );
}