"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type PageResponse<T> = { items: T[]; total: number; page: number; pageSize: number };

const CACHE_TTL_MS = 60_000;
const pageCache = new Map<string, { rows: unknown[]; total: number; at: number }>();
const singleCache = new Map<string, { data: unknown; at: number }>();

function readPageCache<T>(key: string): { rows: T[]; total: number } | null {
  const hit = pageCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return { rows: hit.rows as T[], total: hit.total };
}

function writePageCache(key: string, rows: unknown[], total: number): void {
  pageCache.set(key, { rows, total, at: Date.now() });
}

function readSingleCache<T>(key: string): T | null {
  const hit = singleCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.data as T;
}

function writeSingleCache(key: string, data: unknown): void {
  singleCache.set(key, { data, at: Date.now() });
}

export function useList<T>(path: string, options: { pageSize?: number; autoLoad?: boolean } = {}) {
  const pageSize = options.pageSize ?? 20;
  const autoLoad = options.autoLoad ?? true;
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const key = `${path}?page=${page}&pageSize=${pageSize}`;

  useEffect(() => {
    if (!autoLoad) return;
    const cached = readPageCache<T>(key);
    if (cached && tick === 0) {
      setRows(cached.rows);
      setTotal(cached.total);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<PageResponse<T>>(key)
      .then((response) => {
        if (cancelled) return;
        const items = response.items ?? [];
        setRows(items);
        setTotal(response.total ?? 0);
        writePageCache(key, items, response.total ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, autoLoad, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { rows, total, page, setPage, loading, error, refresh };
}

export function useSimpleList<T>(path: string): { rows: T[]; loading: boolean; refresh: () => void } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cached = readSingleCache<T[]>(path);
    if (cached && tick === 0) {
      setRows(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<T[]>(path)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        writeSingleCache(path, data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { rows, loading, refresh };
}

export function useCachedApi<T>(path: string): { data: T | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cached = readSingleCache<T>(path);
    if (cached && tick === 0) {
      setData(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<T>(path)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        writeSingleCache(path, value);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { data, loading, refresh };
}

let formatLocale: "en" | "ar" = "en";
let companyCurrency = "USD";

export function setFormatLocale(locale: "en" | "ar"): void {
  formatLocale = locale;
}

export function setCompanyCurrency(currencyCode: string): void {
  companyCurrency = currencyCode;
}

const formatLocaleString = (): string => (formatLocale === "ar" ? "ar-EG-u-nu-latn" : "en-US");

export const currency = (value: number | undefined | null, opts?: { maxFractionDigits?: number }): string => {
  const options: Intl.NumberFormatOptions = { style: "currency", currency: companyCurrency };
  if (opts?.maxFractionDigits !== undefined) options.maximumFractionDigits = opts.maxFractionDigits;
  return new Intl.NumberFormat(formatLocaleString(), options).format(value ?? 0);
};

export const dateShort = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString(formatLocaleString(), { month: "short", day: "numeric", year: "numeric" }) : "—";