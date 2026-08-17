"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";

const ALL_PERMISSIONS = [
  "catalog:read",
  "catalog:write",
  "inventory:read",
  "inventory:write",
  "sales:read",
  "sales:write",
  "purchasing:read",
  "purchasing:write",
  "approvals:read",
  "approvals:write",
  "finance:read",
  "finance:write",
  "manufacturing:read",
  "manufacturing:write",
  "hr:read",
  "hr:write",
  "auth:users:read",
  "auth:users:write",
  "auth:roles:read",
  "auth:roles:write",
  "auth:sessions:read",
  "auth:sessions:write",
  "company:read",
  "company:write",
  "dashboard:read",
  "audit:read",
  "notifications:read",
  "imports:read",
  "imports:write",
  "exports:read",
] as const;

const DOMAIN_ORDER = [
  "catalog",
  "inventory",
  "sales",
  "purchasing",
  "finance",
  "manufacturing",
  "hr",
  "approvals",
  "auth",
  "company",
  "dashboard",
  "audit",
  "notifications",
  "imports",
  "exports",
];

type PermissionGroup = { domain: string; permissions: string[] };

const PERMISSION_GROUPS: PermissionGroup[] = DOMAIN_ORDER.map((domain) => ({
  domain,
  permissions: ALL_PERMISSIONS.filter((permission) => permission.startsWith(`${domain}:`)),
})).filter((group) => group.permissions.length > 0);

export function PermissionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (permission: string) => {
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange([...next]);
  };

  const toggleGroup = (group: PermissionGroup) => {
    const next = new Set(selected);
    const allChecked = group.permissions.every((permission) => next.has(permission));
    for (const permission of group.permissions) {
      if (allChecked) next.delete(permission);
      else next.add(permission);
    }
    onChange([...next]);
  };

  return (
    <Stack spacing={2}>
      {PERMISSION_GROUPS.map((group) => {
        const checkedCount = group.permissions.filter((permission) => selected.has(permission)).length;
        const allChecked = checkedCount === group.permissions.length;
        const someChecked = checkedCount > 0 && !allChecked;
        return (
          <Box key={group.domain} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <FormControlLabel
                control={<Checkbox checked={allChecked} indeterminate={someChecked} onChange={() => toggleGroup(group)} disabled={disabled} />}
                label={<Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a", textTransform: "capitalize" }}>{group.domain}</Typography>}
              />
              <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                {checkedCount} of {group.permissions.length}
              </Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
              {group.permissions.map((permission) => (
                <FormControlLabel
                  key={permission}
                  control={<Checkbox size="small" checked={selected.has(permission)} onChange={() => toggle(permission)} disabled={disabled} />}
                  label={<Typography sx={{ fontSize: 12.5, color: "#334155" }}>{permission}</Typography>}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}