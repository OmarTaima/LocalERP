"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { PermissionPicker } from "@/components/permission-picker";
import { useList } from "@/lib/use-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type RoleRow = { id: string; name: string; permissions: string[]; isSystem: boolean };
type UserRow = { id: string; roleId: string };

export default function RolesPage() {
  const t = useTranslations("roles");
  const router = useRouter();
  const { user } = useAuth();
  const { rows, total, page, setPage, loading, refresh } = useList<RoleRow>("/roles", { pageSize: 100 });
  const { rows: users } = useList<UserRow>("/users", { pageSize: 100 });
  const [createOpen, setCreateOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [perms, setPerms] = useState<string[]>([]);

  const canRead = user?.kind === "company" && user.permissions.includes("roles:read");
  const canCreate = user?.kind === "company" && user.permissions.includes("roles:create");
  const canWrite = user?.kind === "company" && user.permissions.includes("roles:write");
  const canDelete = user?.kind === "company" && user.permissions.includes("roles:delete");

  useEffect(() => {
    if (user && !canRead) {
      toastError(t("noPermission"));
      router.replace("/");
    }
  }, [user, canRead, router]);

  const memberCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
    return counts;
  }, [users]);

  if (!user) return <AppShell><Box /></AppShell>;
  if (!canRead) return <AppShell><Box /></AppShell>;

  const openPermDialog = (role: RoleRow) => {
    setEditingRole(role);
    setPerms([...role.permissions]);
    setPermDialogOpen(true);
  };

  const openCreate = () => {
    setEditingRole(null);
    setPerms([]);
    setCreateOpen(true);
  };

  const closePermDialog = () => {
    setPermDialogOpen(false);
    setEditingRole(null);
  };

  const handleDelete = async (role: RoleRow) => {
    const ok = await confirmAction({
      title: t("deleteTitle", { name: role.name }),
      text: t("deleteText"),
      confirmText: t("delete"),
      icon: "warning",
    });
    if (!ok) return;
    try {
      await api(`/roles/${role.id}`, { method: "DELETE" });
      toastSuccess(t("roleDeleted"));
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedDeleteRole"));
    }
  };

  const handleCreate = async (values: Record<string, string | number>) => {
    if (perms.length === 0) {
      toastError(t("selectPermission"));
      return;
    }
    try {
      await api("/roles", { method: "POST", body: { name: values.name, permissions: perms } });
      toastSuccess(t("roleCreated"));
      setCreateOpen(false);
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedCreateRole"));
    }
  };

  const handleSavePerms = async () => {
    if (!editingRole) return;
    try {
      await api(`/roles/${editingRole.id}`, { method: "PATCH", body: { permissions: perms } });
      toastSuccess(t("roleUpdated"));
      closePermDialog();
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUpdateRole"));
    }
  };

  const permDialogReadOnly = editingRole ? editingRole.isSystem : false;

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      </motion.div>
      <motion.div variants={itemVariants}>
        <DataTable
          columns={[
            {
              label: t("role"),
              render: (row) => (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                  {row.isSystem && (
                    <Chip label={t("system")} size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
                  )}
                </Stack>
              ),
            },
            { label: t("members"), render: (row) => t("membersCount", { count: memberCountById.get(row.id) ?? 0 }) },
            { label: t("permissions"), render: (row) => t("permissionsCount", { count: row.permissions.length }) },
          ]}
          rows={rows}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle={t("emptyTitle")}
          emptySubtitle={t("emptySubtitle")}
          emptyIcon={<AdminPanelSettingsOutlinedIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {canWrite && row.name !== "admin" && (
                <Tooltip title={t("editAria", { name: row.name })}>
                  <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => openPermDialog(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
              {canDelete && !row.isSystem && (
                <Tooltip title={t("deleteAria", { name: row.name })}>
                  <IconButton size="small" color="error" aria-label={t("deleteAria", { name: row.name })} onClick={() => void handleDelete(row)}>
                    <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
          actions={
            canCreate ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t("newRole")}</Button>
            ) : undefined
          }
        />

        {editingRole && (
          <Dialog open={permDialogOpen} onClose={closePermDialog} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>
              {editingRole.name}
              <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                {t("permissionsCount", { count: editingRole.permissions.length })}
                {editingRole.isSystem && (
                  <Chip label={t("system")} size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
                )}
              </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ maxHeight: 480, overflow: "auto" }}>
              <PermissionPicker value={perms} onChange={setPerms} disabled={permDialogReadOnly} />
            </DialogContent>
            {!permDialogReadOnly && canWrite && (
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={closePermDialog} sx={{ color: "#64748b" }}>{t("cancel")}</Button>
                <Button variant="contained" onClick={() => void handleSavePerms()}>{t("save")}</Button>
              </DialogActions>
            )}
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
          <PermissionPicker value={perms} onChange={setPerms} />
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}