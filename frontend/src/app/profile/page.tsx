"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/Upload";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { api } from "@/lib/api";

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastError("Please select an image file (png, jpeg, webp)");
      return;
    }
    if (file.size > 1_500_000) {
      toastError("Image must be smaller than 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setUploading(true);
      try {
        const res = await api<{ avatarUrl: string }>("/auth/avatar", { method: "POST", body: { image: dataUrl } });
        setUser({ ...user, avatarUrl: res.avatarUrl });
        toastSuccess("Avatar updated");
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Failed to upload avatar");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
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

  const initials = user.name.slice(0, 2).toUpperCase() || "U";

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Profile" subtitle="Your account details, avatar and password" />
      </motion.div>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3, mb: 3 }}>
        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <Avatar
                  src={user.avatarUrl ?? undefined}
                  sx={{ width: 96, height: 96, border: "1px solid #e2e8f0", fontSize: 32 }}
                >
                  {!user.avatarUrl && initials}
                </Avatar>
                <Tooltip title={uploading ? "Uploading…" : "Change avatar"}>
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      bgcolor: "rgba(0,0,0,0.45)",
                      opacity: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      transition: "opacity 0.15s",
                      cursor: uploading ? "wait" : "pointer",
                      "&:hover": { opacity: 1 },
                    }}
                    onClick={() => !uploading && document.getElementById("avatar-input")?.click()}
                  >
                    <UploadIcon sx={{ fontSize: 22 }} />
                  </Box>
                </Tooltip>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={uploading}
                  onChange={handleAvatarUpload}
                />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: "#0f172a" }}>{user.name}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13 }}>{user.email}</Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <AccountCircleOutlinedIcon sx={{ color: "#64748b", fontSize: 18 }} />
              <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>Role</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.roleName}</Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LockOutlinedIcon sx={{ color: "#64748b", fontSize: 18 }} />
              <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>Status</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.isActive ? "Active" : "Inactive"}</Typography>
            </Stack>

            {user.lastLoginAt && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 13, color: "#64748b", minWidth: 90 }}>Last login</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{new Date(user.lastLoginAt).toLocaleString()}</Typography>
              </Stack>
            )}
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
                label="New password"
                type={showNew ? "text" : "password"}
                size="small"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                helperText="Must include 1 uppercase letter"
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
                label="Confirm new password"
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
              {savingPassword ? "Saving…" : "Change password"}
            </Button>
          </Paper>
        </motion.div>
      </Box>
    </AppShell>
  );
}
