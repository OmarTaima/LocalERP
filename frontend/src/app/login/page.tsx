"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/components/ui";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    totpCode: "",
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password, form.totpCode || undefined);
      toastSuccess(`Welcome back, ${user.name.split(" ")[0]}`);
      router.replace("/");
    } catch (error) {
      toastError(error instanceof ApiError ? error.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 1.2 } }}
      >
        <Box sx={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", top: -140, right: -120, background: "radial-gradient(circle, rgba(79,70,229,0.35) 0%, transparent 70%)" }} />
        <Box sx={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", bottom: -220, left: -180, background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)" }} />
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        <Stack alignItems="center" sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3,
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
              mb: 2,
              boxShadow: "0 12px 32px rgba(79,70,229,0.45)",
            }}
          >
            E
          </Box>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>ERP Suite</Typography>
          <Typography sx={{ color: "#94a3b8", fontSize: 13.5, mt: 0.5 }}>
            Sign in to your workspace
          </Typography>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: 4, p: { xs: 3, sm: 4 }, border: "1px solid rgba(226,232,240,0.6)", boxShadow: "0 24px 64px rgba(2,6,23,0.35)" }}>
          {submitting && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

          <Stack spacing={2.25}>
            <TextField
              label="Email address"
              type="email"
              value={form.email}
              onChange={set("email")}
              size="small"
              required
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ fontSize: 19, color: "#94a3b8" }} /></InputAdornment> } }}
            />
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              size="small"
              required
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><LockOutlinedIcon sx={{ fontSize: 19, color: "#94a3b8" }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                        {showPassword ? <VisibilityOff sx={{ fontSize: 19 }} /> : <Visibility sx={{ fontSize: 19 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Two-factor code (if enabled)"
              value={form.totpCode}
              onChange={set("totpCode")}
              size="small"
              slotProps={{ htmlInput: { maxLength: 6 } }}
            />
            <Button
              variant="contained"
              size="large"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 700, fontSize: 15, py: 1.4 }}
            >
              Sign in
            </Button>
          </Stack>

          <Divider sx={{ my: 3, borderColor: "#e2e8f0" }}>
            <Typography sx={{ fontSize: 11.5, color: "#94a3b8", px: 1 }}>SECURE WORKSPACE</Typography>
          </Divider>
          <Stack direction="row" spacing={2} justifyContent="center">
            {["JWT Auth", "RBAC", "Audit Trail"].map((badge) => (
              <Box key={badge} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Avatar sx={{ width: 14, height: 14, bgcolor: "#059669", fontSize: 9 }}>✓</Avatar>
                <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{badge}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Typography sx={{ textAlign: "center", color: "#475569", fontSize: 12, mt: 3 }}>
          © {new Date().getFullYear()} ERP Suite — secure enterprise management
        </Typography>
      </motion.div>
    </Box>
  );
}