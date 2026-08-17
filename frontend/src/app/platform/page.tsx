"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import LinearProgress from "@mui/material/LinearProgress";
import InputAdornment from "@mui/material/InputAdornment";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { PageHeader, StatusChip, toastError, toastSuccess, confirmAction, itemVariants } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { dateShort } from "@/lib/use-list";
import { api, ApiError, getSaToken, setSaToken } from "@/lib/api";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  usersCount: number;
  createdAt: string;
};

type CompanyRef = { id: string; name: string };

type CompanyRole = { id: string; name: string; permissions: string[]; isSystem: boolean };

const PLAN_TONES: Record<string, { bg: string; color: string }> = {
  starter: { bg: "#f1f5f9", color: "#475569" },
  pro: { bg: "#ede9fe", color: "#7c3aed" },
  enterprise: { bg: "#fef3c7", color: "#d97706" },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

const platformApi = <T,>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
  const token = getSaToken();
  if (!token) throw new ApiError(401, "not signed in to the platform console");
  return api<T>(path, { ...options, headers: { Authorization: `Bearer ${token}` } });
};

const deriveSlug = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function PlatformLogin({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api<{ accessToken: string }>("/admin/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSaToken(res.accessToken);
      onAuthed();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to sign in");
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
          <Typography sx={{ color: "#94a3b8", fontSize: 13.5, mt: 0.5 }}>Platform administration</Typography>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: 4, p: { xs: 3, sm: 4 }, border: "1px solid rgba(226,232,240,0.6)", boxShadow: "0 24px 64px rgba(2,6,23,0.35)" }}>
          {submitting && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
          <Stack spacing={2.25}>
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              required
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ fontSize: 19, color: "#94a3b8" }} /></InputAdornment> } }}
            />
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button
              variant="contained"
              size="large"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 700, fontSize: 15, py: 1.4 }}
            >
              Sign in to console
            </Button>
          </Stack>
        </Paper>
      </motion.div>
    </Box>
  );
}

export default function PlatformPage() {
  const [authed, setAuthed] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState("starter");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTarget, setAdminTarget] = useState<CompanyRef | null>(null);
  const [afterCreate, setAfterCreate] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminRoles, setAdminRoles] = useState<CompanyRole[]>([]);
  const [adminRolesLoading, setAdminRolesLoading] = useState(false);
  const [adminRolesFailed, setAdminRolesFailed] = useState(false);
  const [adminRoleId, setAdminRoleId] = useState("");

  useEffect(() => {
    setAuthed(getSaToken() !== null);
  }, []);

  const fetchCompanies = useCallback((p: number) => {
    setLoading(true);
    platformApi<{ items: CompanyRow[]; total: number }>(`/admin/companies?page=${p}&pageSize=20`)
      .then((res) => {
        setCompanies(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setCompanies([]);
        setTotal(0);
        toastError(err instanceof Error ? err.message : "Failed to load companies");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authed) fetchCompanies(page);
  }, [authed, page, fetchCompanies]);

  useEffect(() => {
    if (!adminOpen || !adminTarget) return;
    let cancelled = false;
    setAdminRolesLoading(true);
    setAdminRolesFailed(false);
    setAdminRoles([]);
    setAdminRoleId("");
    platformApi<CompanyRole[]>(`/admin/companies/${adminTarget.id}/roles`)
      .then((items) => {
        if (cancelled) return;
        setAdminRoles(items);
        const systemAdmin = items.find((role) => role.isSystem && role.name === "admin");
        if (systemAdmin) setAdminRoleId(systemAdmin.id);
      })
      .catch(() => {
        if (!cancelled) setAdminRolesFailed(true);
      })
      .finally(() => {
        if (!cancelled) setAdminRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminOpen, adminTarget]);

  const openNewCompany = () => {
    setCompanyName("");
    setCompanySlug("");
    setSlugTouched(false);
    setPlan("starter");
    setCompanyOpen(true);
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      toastError("Company name is required");
      return;
    }
    if (!SLUG_PATTERN.test(companySlug)) {
      toastError("Slug can only contain lowercase letters, numbers and hyphens");
      return;
    }
    setCreatingCompany(true);
    try {
      const created = await platformApi<CompanyRef>("/admin/companies", {
        method: "POST",
        body: { name: companyName.trim(), slug: companySlug, plan },
      });
      toastSuccess("Company created");
      setCompanyOpen(false);
      fetchCompanies(1);
      setPage(1);
      setAdminTarget(created);
      setAfterCreate(true);
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setCreatingCompany(false);
    }
  };

  const openAddUser = (company: CompanyRow) => {
    setAdminTarget({ id: company.id, name: company.name });
    setAfterCreate(false);
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminOpen(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminTarget) return;
    if (adminPassword.length < 8) {
      toastError("Password must be at least 8 characters");
      return;
    }
    if (adminRolesFailed) {
      toastError("Failed to load roles — please close and reopen the dialog to retry");
      return;
    }
    if (!adminRoleId) {
      toastError("Please select a role");
      return;
    }
    setCreatingAdmin(true);
    try {
      await platformApi(`/admin/companies/${adminTarget.id}/users`, {
        method: "POST",
        body: { name: adminName, email: adminEmail, password: adminPassword, roleId: adminRoleId },
      });
      toastSuccess("Admin created");
      setAdminOpen(false);
      fetchCompanies(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleSignOut = async () => {
    const ok = await confirmAction({
      title: "Sign out of console?",
      text: "You will need your platform credentials to sign in again.",
      confirmText: "Sign out",
      icon: "question",
    });
    if (!ok) return;
    setSaToken(null);
    setAuthed(false);
  };

  if (!authed) {
    return <PlatformLogin onAuthed={() => setAuthed(true)} />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, md: 4 }, py: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 17,
              color: "#fff",
            }}
          >
            E
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Platform Console</Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" onClick={() => void handleSignOut()}>Sign out</Button>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
        <motion.div variants={itemVariants} initial="hidden" animate="show">
          <PageHeader
            title="Companies"
            subtitle="Tenants running on this platform"
            actions={<Button variant="contained" startIcon={<BusinessOutlinedIcon />} onClick={openNewCompany}>New company</Button>}
          />
        </motion.div>

        <DataTable
          columns={[
            { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography> },
            { label: "Slug", render: (row) => <Typography sx={{ fontFamily: "monospace", fontSize: 12.5, color: "#64748b" }}>{row.slug}</Typography> },
            {
              label: "Plan",
              render: (row) => {
                const tone = PLAN_TONES[row.plan] ?? PLAN_TONES.starter;
                return <Chip label={row.plan} size="small" sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700, textTransform: "capitalize" }} />;
              },
            },
            { label: "Users", render: (row) => String(row.usersCount) },
            { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "suspended"} /> },
            { label: "Created", render: (row) => dateShort(row.createdAt) },
          ]}
          rows={companies}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle="No companies"
          emptySubtitle="Companies created from this console appear here"
          emptyIcon={<BusinessOutlinedIcon />}
          rowActions={(row) => (
            <Button size="small" variant="outlined" startIcon={<PersonAddAltIcon />} onClick={() => openAddUser(row)}>
              Add user
            </Button>
          )}
        />
      </Box>

      <Dialog open={companyOpen} onClose={() => setCompanyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>New company</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <TextField
              label="Company name *"
              size="small"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (!slugTouched) setCompanySlug(deriveSlug(e.target.value));
              }}
              fullWidth
            />
            <TextField
              label="Slug *"
              size="small"
              value={companySlug}
              onChange={(e) => {
                setSlugTouched(true);
                setCompanySlug(e.target.value);
              }}
              helperText="Lowercase letters, numbers and hyphens only"
              fullWidth
              slotProps={{ htmlInput: { pattern: "^[a-z0-9-]+$" } }}
            />
            <TextField
              label="Plan"
              select
              size="small"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              fullWidth
            >
              <MenuItem value="starter">Starter</MenuItem>
              <MenuItem value="pro">Pro</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCompanyOpen(false)} sx={{ color: "#64748b" }}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateCompany()} disabled={creatingCompany}>
            {creatingCompany ? "Creating…" : "Create company"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adminOpen} onClose={() => setAdminOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>
          Create the first admin
          {adminTarget && (
            <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, mt: 0.5 }}>
              Set up the administrator for {adminTarget.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <TextField
              label="Name *"
              size="small"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Email address *"
              type="email"
              autoComplete="email"
              size="small"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="Password *"
              type={showAdminPassword ? "text" : "password"}
              autoComplete="new-password"
              size="small"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              helperText="At least 8 characters"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={() => setShowAdminPassword((value) => !value)} aria-label="Toggle password visibility">
                        {showAdminPassword ? <VisibilityOff sx={{ fontSize: 19 }} /> : <Visibility sx={{ fontSize: 19 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Role"
              select
              size="small"
              value={adminRoleId}
              onChange={(e) => setAdminRoleId(e.target.value)}
              fullWidth
              disabled={adminRolesLoading || adminRolesFailed}
            >
              {adminRolesLoading ? (
                <MenuItem value="" disabled>Loading roles…</MenuItem>
              ) : adminRolesFailed ? (
                <MenuItem value="" disabled>Admin (system role)</MenuItem>
              ) : adminRoles.length === 0 ? (
                <MenuItem value="" disabled>No roles available</MenuItem>
              ) : (
                adminRoles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.isSystem && role.name === "admin" ? "Admin (system role)" : role.name}
                  </MenuItem>
                ))
              )}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setAdminOpen(false);
              if (afterCreate) toastSuccess("Company created — you can add users later");
            }}
            sx={{ color: "#64748b" }}
          >
            Skip for now
          </Button>
          <Button variant="contained" onClick={() => void handleCreateAdmin()} disabled={creatingAdmin || adminRolesLoading}>
            {creatingAdmin ? "Creating…" : "Create admin"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}