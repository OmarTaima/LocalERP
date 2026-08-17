"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import { useAppLocale } from "@/lib/locale";

export type Direction = "ltr" | "rtl";

function createDirectionalCache(direction: Direction) {
  return direction === "rtl" ? createCache({ key: "css-rtl" }) : createCache({ key: "css" });
}

export function RtlCacheProvider({ children }: { children: ReactNode }) {
  const { locale } = useAppLocale();
  const direction: Direction = locale === "ar" ? "rtl" : "ltr";
  const cache = useMemo(() => createDirectionalCache(direction), [direction]);

  useServerInsertedHTML(() => {
    const names = Object.keys(cache.inserted);
    if (names.length === 0) return null;
    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: names.map((name) => cache.inserted[name] ?? "").join(""),
        }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <div key={direction}>{children}</div>
    </CacheProvider>
  );
}