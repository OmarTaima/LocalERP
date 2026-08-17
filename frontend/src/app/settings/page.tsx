"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import SaveIcon from "@mui/icons-material/Save";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, toastSuccess, toastError } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CompanySettings = { currency: string; taxRate: number; timezone: string };
type CompanyDoc = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  settings: CompanySettings;
  limits: { maxUsers: number; maxProducts: number; features: string[] };
  createdAt: string;
  updatedAt: string;
};

const CURRENCIES = ["USD", "EUR", "GBP", "EGP", "SAR", "AED", "MAD"];
const TIMEZONES = ["UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Africa/Cairo"];

const PLAN_TONES: Record<string, { bg: string; color: string }> = {
  starter: { bg: "#f1f5f9", color: "#475569" },
  pro: { bg: "#ede9fe", color: "#7c3aed" },
  enterprise: { bg: "#fef3c7", color: "#d97706" },
};

const numberFormat = new Intl.NumberFormat("en-US");

export default function SettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersTotal, setUsersTotal] = useState(0);
  const [productsTotal, setProductsTotal] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const companyData = await api<CompanyDoc>("/company/settings");
        setCompany(companyData);
        setCurrency(companyData.settings.currency);
        setTaxRate(String(companyData.settings.taxRate));
        setTimezone(companyData.settings.timezone);
      } catch {
        setCompany(null);
      } finally {
        setLoading(false);
      }
    })();
    void api<{ total: number }>("/users?page=1&pageSize=1")
      .then((res) => setUsersTotal(res.total))
      .catch(() => undefined);
    void api<{ total: number }>("/products?page=1&pageSize=1")
      .then((res) => setProductsTotal(res.total))
      .catch(() => undefined);
  }, []);

  if (loading || !company) {
    return (
      <AppShell>
        {!loading && !company && (
          <motion.div variants={itemVariants}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
              <Typography sx={{ color: "#dc2626", fontSize: 13.5, fontWeight: 600 }}>
                Could not load company settings. Check that the backend is running.
              </Typography>
            </Paper>
          </motion.div>
        )}
      </AppShell>
    );
  }

  const editable = user?.permissions.includes("company:write") ?? false;
  const planTone = PLAN_TONES[company.plan] ?? PLAN_TONES.starter;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/company/settings", {
        method: "PATCH",
        body: { currency, taxRate: Number(taxRate), timezone },
      });
      toastSuccess("Settings saved");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Settings" subtitle="Workspace and company configuration" />
      </motion.div>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2.5,
                  bgcolor: "#eef2ff",
                  color: "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BusinessOutlinedIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ color: "#0f172a", fontWeight: 700 }} noWrap>{company.name}</Typography>
                <Typography sx={{ fontSize: 12.5, color: "#94a3b8" }} noWrap>{company.slug}</Typography>
              </Box>
              <Chip label={company.plan} size="small" sx={{ bgcolor: planTone.bg, color: planTone.color, fontWeight: 700, textTransform: "capitalize" }} />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={5}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>Users</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#0f172a", mt: 0.5 }}>
                  {usersTotal} <Box component="span" sx={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>of {company.limits.maxUsers}</Box>
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>Products</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#0f172a", mt: 0.5 }}>
                  {numberFormat.format(productsTotal)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" sx={{ color: "#0f172a", mb: 0.5 }}>Workspace settings</Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 2 }}>
              Currency, tax and timezone used across the workspace
            </Typography>
            {!editable && (
              <Alert severity="info" sx={{ mb: 2.5, fontSize: 13 }}>
                You have read-only access to workspace settings. Ask an administrator to make changes.
              </Alert>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
              <TextField
                label="Currency"
                select
                size="small"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!editable}
              >
                {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField
                label="Tax rate"
                type="number"
                size="small"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={!editable}
                slotProps={{
                  htmlInput: { min: 0, max: 100, step: 0.1 },
                  input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                }}
              />
              <TextField
                label="Timezone"
                select
                size="small"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!editable}
                sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              >
                {TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
              </TextField>
            </Box>
            {editable && (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => void handleSave()}
                disabled={saving}
                sx={{ mt: 3 }}
              >
                {saving ? "Saving…" : "Save settings"}
              </Button>
            )}
          </Paper>
        </motion.div>
      </Box>
    </AppShell>
  );
}