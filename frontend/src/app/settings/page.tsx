"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import SaveIcon from "@mui/icons-material/Save";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { AvatarUpload } from "@/components/avatar-upload";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CompanySettings = { currency: string; taxRate: number; timezone: string };
type CompanyDoc = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  isActive: boolean;
  settings: CompanySettings;
  limits: { maxUsers: number; maxProducts: number; features: string[] };
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
  const [tab, setTab] = useState(0);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.kind === "company" ? user.avatarUrl : null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [company, setCompany] = useState<CompanyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersTotal, setUsersTotal] = useState(0);
  const [productsTotal, setProductsTotal] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);

  const canEditProfile = user?.kind === "company" && user.permissions.includes("profile:write");
  const canEditCompany = user?.kind === "company" && user.permissions.includes("companies:write");

  useEffect(() => {
    void (async () => {
      try {
        const companyData = await api<CompanyDoc>("/company/settings");
        setCompany(companyData);
        setCompanyName(companyData.name);
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

  const handleAvatarPicked = async (url: string) => {
    setUploading(true);
    try {
      const res = await api<{ avatarUrl: string }>("/auth/avatar", { method: "POST", body: { avatarUrl: url } });
      setAvatarUrl(res.avatarUrl);
      toastSuccess("Avatar updated");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoPicked = async (url: string) => {
    if (!company) return;
    setLogoUploading(true);
    try {
      const res = await api<{ logoUrl: string }>("/company/logo", { method: "POST", body: { logoUrl: url } });
      setCompany({ ...company, logoUrl: res.logoUrl });
      toastSuccess("Logo updated");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toastError("All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toastError("New password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toastError("New password must include an uppercase letter");
      return;
    }
    const ok = await confirmAction({
      title: "Change password?",
      text: "You will be required to sign in again on other devices.",
      confirmText: "Change password",
    });
    if (!ok) return;
    setSavingPassword(true);
    try {
      await api("/auth/password", {
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      toastSuccess("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      await api("/company/settings", {
        method: "PATCH",
        body: { name: companyName.trim(), settings: { currency, taxRate: Number(taxRate), timezone } },
      });
      toastSuccess("Settings saved");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const planTone = PLAN_TONES[company?.plan ?? ""] ?? PLAN_TONES.starter;
  const initials = user?.name.slice(0, 2).toUpperCase() ?? "U";

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Settings" subtitle="Manage your account and how your workspace works." />
        <Box sx={{ mb: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ minHeight: 48 }}>
            <Tab label="User settings" />
            <Tab label="Company settings" />
          </Tabs>
        </Box>
      </motion.div>

      {tab === 0 && (
        <>
          {!canEditProfile && (
            <motion.div variants={itemVariants}>
              <Alert severity="info" sx={{ mb: 2.5, fontSize: 13 }}>
                You have read-only access. Ask an administrator for changes.
              </Alert>
            </motion.div>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3, mb: 3 }}>
            <motion.div variants={itemVariants}>
              <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <AvatarUpload
                    value={assetUrl(avatarUrl) ?? null}
                    onChange={(url) => { if (url) void handleAvatarPicked(url); }}
                    disabled={!canEditProfile || uploading}
                    size={84}
                    placeholderIcon={<Typography sx={{ fontSize: 28, fontWeight: 700 }}>{initials}</Typography>}
                  />
                  <Box>
                    <Typography variant="h6" sx={{ color: "#0f172a" }}>{user?.name}</Typography>
                    <Typography sx={{ color: "#64748b", fontSize: 13 }}>{user?.email}</Typography>
                    {user?.kind === "company" && (
                      <Typography sx={{ color: "#94a3b8", fontSize: 12, mt: 0.5 }}>
                        {user.roleName} · {user.isActive ? "Active" : "Inactive"}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                  <LockOutlinedIcon sx={{ color: "#64748b", fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, color: "#64748b" }}>Account access is managed by your workspace role.</Typography>
                </Stack>
              </Paper>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ color: "#0f172a", mb: 2 }}>Change password</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Current password"
                    type={showCurrent ? "text" : "password"}
                    size="small"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={!canEditProfile || savingPassword}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button size="small" onClick={() => setShowCurrent(!showCurrent)} sx={{ minWidth: "auto", p: 0.5 }} disabled={!canEditProfile}>
                              {showCurrent ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    label="New password"
                    type={showNew ? "text" : "password"}
                    size="small"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={!canEditProfile || savingPassword}
                    helperText="Must include 1 uppercase letter"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button size="small" onClick={() => setShowNew(!showNew)} sx={{ minWidth: "auto", p: 0.5 }} disabled={!canEditProfile}>
                              {showNew ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    label="Confirm new password"
                    type={showConfirm ? "text" : "password"}
                    size="small"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!canEditProfile || savingPassword}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button size="small" onClick={() => setShowConfirm(!showConfirm)} sx={{ minWidth: "auto", p: 0.5 }} disabled={!canEditProfile}>
                              {showConfirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Stack>
                {canEditProfile && (
                  <Button
                    variant="contained"
                    startIcon={savingPassword ? undefined : <SaveIcon />}
                    onClick={() => void handlePasswordChange()}
                    disabled={savingPassword}
                    sx={{ mt: 2 }}
                  >
                    {savingPassword ? "Saving…" : "Change password"}
                  </Button>
                )}
              </Paper>
            </motion.div>
          </Box>
        </>
      )}

      {tab === 1 && (
        <>
          {!canEditCompany && (
            <motion.div variants={itemVariants}>
              <Alert severity="info" sx={{ mb: 2.5, fontSize: 13 }}>
                You have read-only access to workspace settings. Ask an administrator to make changes.
              </Alert>
            </motion.div>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
            <motion.div variants={itemVariants}>
              <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
                {!company && !loading && (
                  <Typography sx={{ color: "#dc2626", fontSize: 13.5, fontWeight: 600 }}>
                    Could not load company settings. Check that the backend is running.
                  </Typography>
                )}
                {company && (
                  <>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 2 }}>
                      <AvatarUpload
                        value={assetUrl(company.logoUrl) ?? null}
                        onChange={(url) => { if (url) void handleLogoPicked(url); }}
                        disabled={!canEditCompany || logoUploading}
                        size={56}
                        shape="rounded"
                        folder="logos"
                        placeholderIcon={<BusinessOutlinedIcon sx={{ fontSize: 28 }} />}
                      />
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
                  </>
                )}
              </Paper>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ color: "#0f172a", mb: 0.5 }}>Workspace settings</Typography>
                <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 2 }}>
                  Company name, currency, tax and timezone used across the workspace
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                  <TextField
                    label="Company name"
                    size="small"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={!canEditCompany}
                    sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
                  />
                  <TextField
                    label="Currency"
                    select
                    size="small"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={!canEditCompany}
                  >
                    {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Tax rate"
                    type="number"
                    size="small"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    disabled={!canEditCompany}
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
                    disabled={!canEditCompany}
                    sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
                  >
                    {TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                  </TextField>
                </Box>
                {canEditCompany && (
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => void handleSaveCompany()}
                    disabled={saving}
                    sx={{ mt: 3 }}
                  >
                    {saving ? "Saving…" : "Save settings"}
                  </Button>
                )}
              </Paper>
            </motion.div>
          </Box>
        </>
      )}
    </AppShell>
  );
}