"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";

const MODULES = [
  "catalog",
  "inventory",
  "sales",
  "purchasing",
  "manufacturing",
  "hr",
  "accountant",
  "companies",
  "users",
  "roles",
  "profile",
] as const;

const ACCESS_LEVELS = ["read", "write", "create", "delete"] as const;

const moduleRank = (module: string): number => {
  const index = MODULES.indexOf(module as (typeof MODULES)[number]);
  return index === -1 ? MODULES.length : index;
};

const accessRank = (access: string): number => {
  const index = ACCESS_LEVELS.indexOf(access as (typeof ACCESS_LEVELS)[number]);
  return index === -1 ? ACCESS_LEVELS.length : index;
};

function sortPermissions(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const [moduleA, accessA] = a.split(":");
    const [moduleB, accessB] = b.split(":");
    const moduleDiff = moduleRank(moduleA) - moduleRank(moduleB);
    if (moduleDiff !== 0) return moduleDiff;
    return accessRank(accessA) - accessRank(accessB);
  });
}

export function PermissionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const selected = useMemo(() => new Set(value), [value]);

  const emit = (next: string[]) => onChange(sortPermissions(next));

  const toggle = (permission: string) => {
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    emit([...next]);
  };

  const toggleModule = (module: string) => {
    const next = new Set(selected);
    const codes = ACCESS_LEVELS.map((access) => `${module}:${access}`);
    const allChecked = codes.every((code) => next.has(code));
    for (const code of codes) {
      if (allChecked) next.delete(code);
      else next.add(code);
    }
    emit([...next]);
  };

  return (
    <Stack spacing={2}>
      {MODULES.map((module) => {
        const codes = ACCESS_LEVELS.map((access) => `${module}:${access}`);
        const checkedCount = codes.filter((code) => selected.has(code)).length;
        const allChecked = checkedCount === codes.length;
        const someChecked = checkedCount > 0 && !allChecked;
        return (
          <Box key={module} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <FormControlLabel
                control={<Checkbox checked={allChecked} indeterminate={someChecked} onChange={() => toggleModule(module)} disabled={disabled} />}
                label={<Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a", textTransform: "capitalize" }}>{t(`permModules.${module}`)}</Typography>}
              />
              <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                {checkedCount} of {codes.length}
              </Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 0.5 }}>
              {codes.map((code) => (
                <FormControlLabel
                  key={code}
                  control={<Checkbox size="small" checked={selected.has(code)} onChange={() => toggle(code)} disabled={disabled} />}
                  label={<Typography sx={{ fontSize: 12.5, color: "#334155" }}>{t(`permAccessLevels.${code.split(":")[1]}`)}</Typography>}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}