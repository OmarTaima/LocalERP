"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import SaveIcon from "@mui/icons-material/Save";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { AvatarUpload } from "@/components/avatar-upload";
import { api, assetUrl } from "@/lib/api";
import { useAppLocale } from "@/lib/locale";

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  companyId: string;
  plan: string;
  permissions: string[];
  roleName: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { locale } = useAppLocale();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    api<CurrentUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !user) {
    return (
      <AppShell>
        <Box />
      </AppShell>
    );
  }

  const handleAvatarPicked = async (url: string) => {
    setUploading(true);
    try {
      const res = await api<{ avatarUrl: string }>("/auth/avatar", { method: "POST", body: { avatarUrl: url } });
      setUser({ ...user, avatarUrl: res.avatarUrl });
      toastSuccess(t("avatarUpdated"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUploadAvatar"));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toastError(t("allPasswordFieldsRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError(t("newPasswordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      toastError(t("newPasswordMinLength"));
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toastError(t("newPasswordUppercase"));
      return;
    }
    const ok = await confirmAction({
      title: t("changePasswordTitle"),
      text: t("changePasswordText"),
      confirmText: t("changePassword"),
    });
    if (!ok) return;
    setSavingPassword(true);
    try {
      await api("/auth/password", {
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      toastSuccess(t("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedChangePassword"));
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = user.name.slice(0, 2).toUpperCase() || "U";

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      </motion.div>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3, mb: 3 }}>
        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
              <AvatarUpload
                value={assetUrl(user.avatarUrl) ?? null}
                onChange={(url) => { if (url) void handleAvatarPicked(url); }}
                disabled={uploading}
                size={96}
                placeholderIcon={<Typography sx={{ fontSize: 28, fontWeight: 700 }}>{initials}</Typography>}
              />
              <Box>
                <Typography variant="h6" sx={{ color: "#0f172a" }}>{user.name}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13 }}>{user.email}</Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <AccountCircleOutlinedIcon sx={{ color: "#64748b", fontSize: 18 }} />
              <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>{t("role")}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.roleName}</Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LockOutlinedIcon sx={{ color: "#64748b", fontSize: 18 }} />
              <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>{t("status")}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.isActive ? t("active") : t("inactive")}</Typography>
            </Stack>

            {user.lastLoginAt && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>{t("lastLogin")}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{new Date(user.lastLoginAt).toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US")}</Typography>
              </Stack>
            )}
          </Paper>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" sx={{ color: "#0f172a", mb: 2 }}>{t("changePassword")}</Typography>
            <Stack spacing={2}>
              <TextField
                label={t("currentPassword")}
                type={showCurrent ? "text" : "password"}
                size="small"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => setShowCurrent(!showCurrent)} sx={{ minWidth: "auto", p: 0.5 }}>
                          {showCurrent ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label={t("newPassword")}
                type={showNew ? "text" : "password"}
                size="small"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                helperText={t("passwordHelper")}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => setShowNew(!showNew)} sx={{ minWidth: "auto", p: 0.5 }}>
                          {showNew ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label={t("confirmNewPassword")}
                type={showConfirm ? "text" : "password"}
                size="small"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => setShowConfirm(!showConfirm)} sx={{ minWidth: "auto", p: 0.5 }}>
                          {showConfirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
            <Button
              variant="contained"
              startIcon={savingPassword ? undefined : <SaveIcon />}
              onClick={() => void handlePasswordChange()}
              disabled={savingPassword}
              sx={{ mt: 2 }}
            >
              {savingPassword ? t("saving") : t("changePassword")}
            </Button>
          </Paper>
        </motion.div>
      </Box>
    </AppShell>
  );
}
