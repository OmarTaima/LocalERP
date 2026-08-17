"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { arMessages, enMessages } from "@/messages";
import { setUiLocale } from "@/components/ui";
import { setFormatLocale } from "@/lib/use-list";

export type Locale = "en" | "ar";

const LOCALE_STORAGE_KEY = "erp-locale";
const LOCALE_COOKIE_KEY = "erp-locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "ar";
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const cookieMatch = document.cookie.match(/(?:^|;\s*)erp-locale=(en|ar)/);
  if (cookieMatch) return cookieMatch[1] as Locale;
  return "en";
}

function getBrowserTimeZone(): string {
  if (typeof window === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.cookie = `${LOCALE_COOKIE_KEY}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  useEffect(() => {
    setUiLocale(locale);
    setFormatLocale(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  const messages = locale === "ar" ? arMessages : enMessages;
  const timeZone = useMemo(getBrowserTimeZone, []);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useAppLocale must be used within LocaleProvider");
  return context;
}