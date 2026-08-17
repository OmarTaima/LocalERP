"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastError, toastSuccess, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { AvatarUpload } from "@/components/avatar-upload";
import { dateShort } from "@/lib/use-list";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  isActive: boolean;
  usersCount: number;
  createdAt: string;
};

const PLAN_TONES: Record<string, { bg: string; color: string }> = {
  starter: { bg: "#f1f5f9", color: "#475569" },
  pro: { bg: "#ede9fe", color: "#7c3aed" },
  enterprise: { bg: "#fef3c7", color: "#d97706" },
};

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const deriveSlug = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export default function CompaniesPage() {
  const router = useRouter();
  const { user } = useAuth();
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
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (user && user.kind !== "superadmin") {
      toastError("You don't have permission to manage companies");
      router.replace("/");
    }
  }, [user, router]);

  const fetchCompanies = useCallback((p: number) => {
    setLoading(true);
    api<{ items: CompanyRow[]; total: number }>(`/admin/companies?page=${p}&pageSize=20`)
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
    if (user?.kind === "superadmin") fetchCompanies(page);
  }, [user?.kind, page, fetchCompanies]);

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
      await api("/admin/companies", {
        method: "POST",
        body: { name: companyName.trim(), slug: companySlug, plan },
      });
      toastSuccess("Company created");
      setCompanyOpen(false);
      setPage(1);
      fetchCompanies(1);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setCreatingCompany(false);
    }
  };

  const openEdit = (row: CompanyRow) => {
    setEditTarget(row);
    setEditActive(row.isActive);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditTarget(null);
  };

  const handleUpdateCompany = async (values: Record<string, string | number>) => {
    if (!editTarget) return;
    try {
      await api(`/admin/companies/${editTarget.id}`, {
        method: "PATCH",
        body: { name: String(values.name).trim(), plan: String(values.plan), isActive: editActive },
      });
      toastSuccess("Company updated");
      closeEdit();
      fetchCompanies(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to update company");
    }
  };

  const handleUploadLogo = async (image: string) => {
    if (!editTarget) return;
    setLogoUploading(true);
    try {
      const res = await api<{ logoUrl: string }>(`/admin/companies/${editTarget.id}/logo`, {
        method: "POST",
        body: { image },
      });
      setEditTarget({ ...editTarget, logoUrl: res.logoUrl });
      toastSuccess("Logo updated");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDeleteCompany = async (row: CompanyRow) => {
    const ok = await confirmAction({
      title: `Delete ${row.name}?`,
      text: "The workspace will be deactivated. Its data stays stored but no one can sign in.",
      confirmText: "Delete",
      icon: "warning",
    });
    if (!ok) return;
    try {
      await api(`/admin/companies/${row.id}`, { method: "DELETE" });
      toastSuccess("Company deactivated");
      fetchCompanies(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to deactivate company");
    }
  };

  if (!user || user.kind !== "superadmin") {
    return (
      <AppShell>
        <Box />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Companies"
          subtitle="Create and manage the workspaces on this platform."
          actions={<Button variant="contained" startIcon={<BusinessOutlinedIcon />} onClick={openNewCompany}>New company</Button>}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <DataTable
          columns={[
            { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography> },
            {
              label: "Logo",
              render: (row) => (
                <Avatar variant="rounded" src={assetUrl(row.logoUrl)} sx={{ width: 36, height: 36, bgcolor: "#eef2ff", color: "#4f46e5" }}>
                  {!row.logoUrl && <BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
                </Avatar>
              ),
            },
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
          emptySubtitle="Create your first workspace to get started"
          emptyIcon={<BusinessOutlinedIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="outlined" aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}>
                <EditIcon fontSize="small" />
              </Button>
              <Button size="small" variant="outlined" color="error" aria-label={`Delete ${row.name}`} onClick={() => void handleDeleteCompany(row)}>
                <DeleteOutlineIcon fontSize="small" />
              </Button>
            </Stack>
          )}
        />
      </motion.div>

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
              {PLAN_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
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

      <FormDialog
        key={editTarget ? `edit-${editTarget.id}` : "edit-company"}
        open={editOpen}
        title={editTarget ? `Edit ${editTarget.name}` : "Edit company"}
        subtitle="Update the workspace name, plan and status"
        maxWidth="sm"
        fields={[
          { name: "name", label: "Company name", required: true, defaultValue: editTarget?.name },
          { name: "plan", label: "Plan", type: "select", required: true, options: PLAN_OPTIONS, defaultValue: editTarget?.plan },
        ]}
        initialValues={editTarget ? { name: editTarget.name, plan: editTarget.plan } : undefined}
        onSubmit={handleUpdateCompany}
        onClose={closeEdit}
        submitLabel="Save"
      >
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>Active</Typography>}
          />
          <Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", mb: 1 }}>Logo</Typography>
            <AvatarUpload
              value={assetUrl(editTarget?.logoUrl) ?? null}
              onChange={(dataUrl) => { if (dataUrl) void handleUploadLogo(dataUrl); }}
              disabled={logoUploading}
            />
          </Box>
        </Stack>
      </FormDialog>
    </AppShell>
  );
}