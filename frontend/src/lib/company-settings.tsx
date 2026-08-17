"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { setCompanyCurrency } from "./use-list";

type CompanySettingsResponse = { settings: { currency: string } };

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.kind !== "company") return;
    void api<CompanySettingsResponse>("/company/settings")
      .then((response) => setCompanyCurrency(response.settings.currency ?? "USD"))
      .catch(() => undefined);
  }, [user]);

  return <>{children}</>;
}