"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
  const router = useRouter();
  const { user } = useAuth();
  const { rows, total, page, setPage, loading, refresh } = useList<RoleRow>("/roles", { pageSize: 100 });
  const { rows: users } = useList<UserRow>("/users", { pageSize: 100 });
  const [createOpen, setCreateOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (user && !user.permissions.includes("auth:roles:read")) {
      toastError("You don't have permission to manage roles");
      router.replace("/");
    }
  }, [user, router]);

  const memberCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
    return counts;
  }, [users]);

  if (!user) return <AppShell><Box /></AppShell>;
  if (!user.permissions.includes("auth:roles:read")) return <AppShell><Box /></AppShell>;

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

  const handleDelete = async (role: RoleRow) => {
    const ok = await confirmAction({
      title: `Delete role ${role.name}?`,
      text: "Members assigned to this role must be reassigned first.",
      confirmText: "Delete",
      icon: "warning",
    });
    if (!ok) return;
    try {
      await api(`/roles/${role.id}`, { method: "DELETE" });
      toastSuccess("Role deleted");
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  const handleCreate = async (values: Record<string, string | number>) => {
    if (perms.length === 0) {
      toastError("Select at least one permission");
      return;
    }
    try {
      await api("/roles", { method: "POST", body: { name: values.name, permissions: perms } });
      toastSuccess("Role created");
      setCreateOpen(false);
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to create role");
    }
  };

  const handleSavePerms = async () => {
    if (!editingRole) return;
    try {
      await api(`/roles/${editingRole.id}`, { method: "PATCH", body: { permissions: perms } });
      toastSuccess("Role updated");
      setPermDialogOpen(false);
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const isAdminRole = editingRole?.name === "admin";
  const permDialogReadOnly = editingRole ? editingRole.isSystem : false;

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Roles" subtitle="Permissions and access levels" />
      </motion.div>
      <motion.div variants={itemVariants}>
        <DataTable
          columns={[
            {
              label: "Role",
              render: (row) => (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                  {row.isSystem && (
                    <Chip label="System" size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
                  )}
                </Stack>
              ),
            },
            { label: "Members", render: (row) => `${memberCountById.get(row.id) ?? 0} users` },
            { label: "Permissions", render: (row) => `${row.permissions.length} permissions` },
          ]}
          rows={rows}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle="No roles"
          emptyIcon={<AdminPanelSettingsOutlinedIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {row.name !== "admin" && (
                <Button size="small" variant="outlined" aria-label={`Edit ${row.name}`} onClick={() => openPermDialog(row)}>
                  <EditIcon fontSize="small" />
                </Button>
              )}
              {!row.isSystem && (
                <Button size="small" variant="outlined" color="error" aria-label={`Delete ${row.name}`} onClick={() => void handleDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </Button>
              )}
            </Stack>
          )}
          actions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New role</Button>
          }
        />

        <Dialog open={permDialogOpen} onClose={() => setPermDialogOpen(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>
            {editingRole?.name}
            <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
              {editingRole ? `${editingRole.permissions.length} permissions` : ""}
              {editingRole?.isSystem && (
                <Chip label="System" size="small" sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11 }} />
              )}
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ maxHeight: 480, overflow: "auto" }}>
            <PermissionPicker value={perms} onChange={setPerms} disabled={permDialogReadOnly} />
          </DialogContent>
          {!permDialogReadOnly && (
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setPermDialogOpen(false)} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button variant="contained" onClick={() => void handleSavePerms()} disabled={isAdminRole}>Save</Button>
            </DialogActions>
          )}
        </Dialog>

        <FormDialog
          key={createOpen ? "new-role" : "closed"}
          open={createOpen}
          title="New role"
          maxWidth="md"
          fields={[{ name: "name", label: "Name", required: true }]}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
          submitLabel="Create role"
        >
          <PermissionPicker value={perms} onChange={setPerms} />
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}