"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, EmptyState, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { PermissionPicker } from "@/components/permission-picker";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CompanyOption = { id: string; name: string };
type CompanyRole = { id: string; name: string; permissions: string[]; isSystem: boolean };

export default function PlatformRolesPage() {
  const router = useRouter();
  const t = useTranslations("platform");
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPerms, setCreatePerms] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.kind !== "superadmin") {
      toastError(t("noPermissionManageRoles"));
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    void api<{ items: CompanyOption[]; total: number }>("/admin/companies?page=1&pageSize=100")
      .then((res) => setCompanies(res.items))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!companyId) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    api<CompanyRole[]>(`/admin/companies/${companyId}/roles`)
      .then((items) => {
        if (!cancelled) setRoles(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setRoles([]);
          toastError(err instanceof Error ? err.message : t("failedLoadRoles"));
        }
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const refetchRoles = () => {
    if (!companyId) return;
    void (async () => {
      try {
        const items = await api<CompanyRole[]>(`/admin/companies/${companyId}/roles`);
        setRoles(items);
      } catch (err) {
        toastError(err instanceof Error ? err.message : t("failedLoadRoles"));
      }
    })();
  };

  const openPermDialog = (role: CompanyRole) => {
    setEditingRole(role);
    setDialogName(role.name);
    setPerms([...role.permissions]);
    setPermDialogOpen(true);
  };

  const closePermDialog = () => {
    setPermDialogOpen(false);
    setEditingRole(null);
  };

  const handleSaveRole = async () => {
    if (!editingRole || !companyId) return;
    try {
      await api(`/admin/companies/${companyId}/roles/${editingRole.id}`, {
        method: "PATCH",
        body: {
          ...(editingRole.isSystem ? {} : { name: dialogName }),
          permissions: perms,
        },
      });
      toastSuccess(t("roleUpdated"));
      closePermDialog();
      refetchRoles();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUpdateRole"));
    }
  };

  const handleDelete = async (role: CompanyRole) => {
    if (!companyId) return;
    const ok = await confirmAction({
      title: t("deleteTitle", { name: role.name }),
      text: t("deleteText"),
      confirmText: t("delete"),
      icon: "warning",
    });
    if (!ok) return;
    try {
      await api(`/admin/companies/${companyId}/roles/${role.id}`, { method: "DELETE" });
      toastSuccess(t("roleDeleted"));
      refetchRoles();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedDeleteRole"));
    }
  };

  const handleCreate = async (values: Record<string, string | number>) => {
    if (!companyId) return;
    if (createPerms.length === 0) {
      toastError(t("selectPermission"));
      return;
    }
    try {
      await api(`/admin/companies/${companyId}/roles`, {
        method: "POST",
        body: { name: values.name, permissions: createPerms },
      });
      toastSuccess(t("roleCreated"));
      setCreateOpen(false);
      setCreatePerms([]);
      refetchRoles();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedCreateRole"));
    }
  };

  if (!user) return <AppShell><Box /></AppShell>;
  if (user.kind !== "superadmin") return <AppShell><Box /></AppShell>;

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitleRoles")} subtitle={t("pageSubtitleRoles")} />
      </motion.div>
      <motion.div variants={itemVariants}>
        <TextField
          select
          size="small"
          label={t("workspace")}
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          sx={{ mb: 2, width: { xs: "100%", sm: 320 } }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="" disabled>{t("selectWorkspace")}</MenuItem>
          {companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
          ))}
        </TextField>

        {!companyId ? (
          <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3 }}>
            <EmptyState
              icon={<AdminPanelSettingsOutlinedIcon />}
              title={t("selectWorkspaceTitle")}
              subtitle={t("selectWorkspaceSubtitle")}
            />
          </Paper>
        ) : (
          <DataTable
            columns={[
              {
                label: t("role"),
                render: (row) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                    {row.isSystem && (
                      <Chip label={t("systemChip")} size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
                    )}
                  </Stack>
                ),
              },
              { label: t("permissions"), render: (row) => t("permissionsCount", { count: row.permissions.length }) },
            ]}
            rows={roles}
            total={roles.length}
            page={1}
            onPageChange={() => undefined}
            loading={rolesLoading}
            emptyTitle={t("emptyRolesTitle")}
            emptySubtitle={t("emptyRolesSubtitle")}
            rowActions={(row) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title={t("editAria", { name: row.name })}>
                  <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => openPermDialog(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                {!row.isSystem && (
                  <Tooltip title={t("deleteAria", { name: row.name })}>
                    <IconButton size="small" color="error" aria-label={t("deleteAria", { name: row.name })} onClick={() => void handleDelete(row)}>
                      <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            )}
            actions={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreatePerms([]); setCreateOpen(true); }}>
                {t("newRole")}
              </Button>
            }
          />
        )}

        {editingRole && (
          <Dialog open={permDialogOpen} onClose={closePermDialog} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>
              {editingRole.name}
              <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                {t("permissionsCount", { count: editingRole.permissions.length })}
                {editingRole.isSystem && (
                  <Chip label={t("systemRoleChip")} size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
                )}
              </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ maxHeight: 560, overflow: "auto" }}>
              <Stack spacing={2}>
                <TextField
                  label={t("name")}
                  size="small"
                  value={dialogName}
                  onChange={(e) => setDialogName(e.target.value)}
                  disabled={editingRole.isSystem}
                  helperText={editingRole.isSystem ? t("systemRoleLocked") : undefined}
                />
                <PermissionPicker value={perms} onChange={setPerms} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={closePermDialog} sx={{ color: "#64748b" }}>{t("cancel")}</Button>
              <Button variant="contained" onClick={() => void handleSaveRole()}>{t("save")}</Button>
            </DialogActions>
          </Dialog>
        )}

        <FormDialog
          open={createOpen}
          title={t("newRole")}
          maxWidth="md"
          fields={[{ name: "name", label: t("name"), required: true }]}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
          submitLabel={t("createRole")}
        >
          <PermissionPicker value={createPerms} onChange={setCreatePerms} />
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}