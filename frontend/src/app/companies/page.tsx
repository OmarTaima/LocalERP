"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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

const deriveSlug = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export default function CompaniesPage() {
  const t = useTranslations("companies");
  const planOptions = [
    { value: "starter", label: t("planStarter") },
    { value: "pro", label: t("planPro") },
    { value: "enterprise", label: t("planEnterprise") },
  ];
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
      toastError(t("noPermission"));
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
        toastError(err instanceof Error ? err.message : t("failedLoadCompanies"));
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
      toastError(t("companyNameRequired"));
      return;
    }
    if (!SLUG_PATTERN.test(companySlug)) {
      toastError(t("slugInvalid"));
      return;
    }
    setCreatingCompany(true);
    try {
      await api("/admin/companies", {
        method: "POST",
        body: { name: companyName.trim(), slug: companySlug, plan },
      });
      toastSuccess(t("companyCreated"));
      setCompanyOpen(false);
      setPage(1);
      fetchCompanies(1);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedCreateCompany"));
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
      toastSuccess(t("companyUpdated"));
      closeEdit();
      fetchCompanies(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUpdateCompany"));
    }
  };

  const handleUploadLogo = async (logoUrl: string) => {
    if (!editTarget) return;
    setLogoUploading(true);
    try {
      const res = await api<{ logoUrl: string }>(`/admin/companies/${editTarget.id}/logo`, {
        method: "POST",
        body: { logoUrl },
      });
      setEditTarget({ ...editTarget, logoUrl: res.logoUrl });
      toastSuccess(t("logoUpdated"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUploadLogo"));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDeleteCompany = async (row: CompanyRow) => {
    const ok = await confirmAction({
      title: t("deleteTitle", { name: row.name }),
      text: t("deleteText"),
      confirmText: t("delete"),
      icon: "warning",
    });
    if (!ok) return;
    try {
      await api(`/admin/companies/${row.id}`, { method: "DELETE" });
      toastSuccess(t("companyDeactivated"));
      fetchCompanies(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedDeactivateCompany"));
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
          title={t("pageTitle")}
          subtitle={t("pageSubtitle")}
          actions={<Button variant="contained" startIcon={<BusinessOutlinedIcon />} onClick={openNewCompany}>{t("newCompany")}</Button>}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <DataTable
          columns={[
            { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography> },
            {
              label: t("logo"),
              render: (row) => (
                <Avatar variant="rounded" src={assetUrl(row.logoUrl)} sx={{ width: 36, height: 36, bgcolor: "#eef2ff", color: "#4f46e5" }}>
                  {!row.logoUrl && <BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
                </Avatar>
              ),
            },
            { label: t("slug"), render: (row) => <Typography sx={{ fontFamily: "monospace", fontSize: 12.5, color: "#64748b" }}>{row.slug}</Typography> },
            {
              label: t("plan"),
              render: (row) => {
                const tone = PLAN_TONES[row.plan] ?? PLAN_TONES.starter;
                return <Chip label={row.plan} size="small" sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700, textTransform: "capitalize" }} />;
              },
            },
            { label: t("users"), render: (row) => String(row.usersCount) },
            { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "suspended"} /> },
            { label: t("created"), render: (row) => dateShort(row.createdAt) },
          ]}
          rows={companies}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle={t("emptyTitle")}
          emptySubtitle={t("emptySubtitle")}
          emptyIcon={<BusinessOutlinedIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("editAria", { name: row.name })}>
                <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => openEdit(row)}>
                  <EditOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("deleteAria", { name: row.name })}>
                <IconButton size="small" color="error" aria-label={t("deleteAria", { name: row.name })} onClick={() => void handleDeleteCompany(row)}>
                  <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        />
      </motion.div>

      <Dialog open={companyOpen} onClose={() => setCompanyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>{t("newCompany")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <TextField
              label={t("companyNameField")}
              size="small"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (!slugTouched) setCompanySlug(deriveSlug(e.target.value));
              }}
              fullWidth
            />
            <TextField
              label={t("slugField")}
              size="small"
              value={companySlug}
              onChange={(e) => {
                setSlugTouched(true);
                setCompanySlug(e.target.value);
              }}
              helperText={t("slugHelper")}
              fullWidth
              slotProps={{ htmlInput: { pattern: "^[a-z0-9-]+$" } }}
            />
            <TextField
              label={t("plan")}
              select
              size="small"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              fullWidth
            >
              {planOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCompanyOpen(false)} sx={{ color: "#64748b" }}>{t("cancel")}</Button>
          <Button variant="contained" onClick={() => void handleCreateCompany()} disabled={creatingCompany}>
            {creatingCompany ? t("creating") : t("createCompany")}
          </Button>
        </DialogActions>
      </Dialog>

      <FormDialog
        key={editTarget ? `edit-${editTarget.id}` : "edit-company"}
        open={editOpen}
        title={editTarget ? t("editCompanyTitle", { name: editTarget.name }) : t("editCompany")}
        subtitle={t("editCompanySubtitle")}
        maxWidth="sm"
        fields={[
          { name: "name", label: t("companyName"), required: true, defaultValue: editTarget?.name },
          { name: "plan", label: t("plan"), type: "select", required: true, options: planOptions, defaultValue: editTarget?.plan },
        ]}
        initialValues={editTarget ? { name: editTarget.name, plan: editTarget.plan } : undefined}
        onSubmit={handleUpdateCompany}
        onClose={closeEdit}
        submitLabel={t("save")}
      >
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>{t("active")}</Typography>}
          />
          <Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", mb: 1 }}>{t("logo")}</Typography>
            <AvatarUpload
              value={assetUrl(editTarget?.logoUrl) ?? null}
              onChange={(url) => { if (url) void handleUploadLogo(url); }}
              disabled={logoUploading}
              folder="logos"
            />
          </Box>
        </Stack>
      </FormDialog>
    </AppShell>
  );
}