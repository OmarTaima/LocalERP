"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { useList, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type UserRow = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
};

type RoleRow = { id: string; name: string; permissions: string[]; isSystem: boolean };

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { rows: roles } = useList<RoleRow>("/roles", { pageSize: 100 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editingActive, setEditingActive] = useState(true);

  useEffect(() => {
    if (user && !user.permissions.includes("auth:users:read")) {
      toastError("You don't have permission to manage users");
      router.replace("/");
    }
  }, [user, router]);

  const fetchData = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "20" });
    if (search) params.set("search", search);
    api<{ items: UserRow[]; total: number }>("/users?" + params.toString())
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setUsers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(page);
  }, [page, search]);

  const roleNameById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const roleOptions = roles.map((role) => ({ value: role.id, label: role.name }));
  const employeeRole = roles.find((role) => role.name === "employee");

  if (!user) return <AppShell><Box /></AppShell>;
  if (!user.permissions.includes("auth:users:read")) return <AppShell><Box /></AppShell>;

  const openCreate = () => {
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setEditingActive(row.isActive);
    setCreateOpen(true);
  };

  const handleToggleActive = async (row: UserRow) => {
    if (row.isActive) {
      const ok = await confirmAction({
        title: `Deactivate ${row.name}?`,
        text: "They will no longer be able to sign in until reactivated.",
        confirmText: "Deactivate",
        icon: "warning",
      });
      if (!ok) return;
    }
    try {
      await api(`/users/${row.id}`, { method: "PATCH", body: { isActive: !row.isActive } });
      toastSuccess(row.isActive ? "User deactivated" : "User reactivated");
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleSubmit = async (values: Record<string, string | number>) => {
    if (!editing && String(values.password).length < 8) {
      toastError("Password must be at least 8 characters");
      return;
    }
    try {
      if (editing) {
        await api(`/users/${editing.id}`, {
          method: "PATCH",
          body: { name: values.name, roleId: values.roleId, isActive: editingActive },
        });
        toastSuccess("User updated");
      } else {
        await api("/users", {
          method: "POST",
          body: {
            name: values.name,
            email: values.email,
            password: values.password,
            ...(values.roleId ? { roleId: values.roleId } : {}),
          },
        });
        toastSuccess("User created");
      }
      setCreateOpen(false);
      setEditing(null);
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save user");
    }
  };

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Users" subtitle="Manage company users, roles and access" />
      </motion.div>
      <motion.div variants={itemVariants}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 240 }}
          />
        </Stack>
        <DataTable
          columns={[
            {
              label: "User",
              render: (row) => (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={row.avatarUrl ?? undefined} sx={{ width: 34, height: 34, bgcolor: "#4f46e5", fontSize: 13, fontWeight: 700 }}>
                    {!row.avatarUrl && row.name.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{row.email}</Typography>
                  </Box>
                </Stack>
              ),
            },
            {
              label: "Role",
              render: (row) => {
                const roleName = roleNameById.get(row.roleId);
                return (
                  <Chip
                    label={roleName ?? "Unknown"}
                    size="small"
                    sx={{
                      bgcolor: roleName ? "#ede9fe" : "#f1f5f9",
                      color: roleName ? "#7c3aed" : "#475569",
                      fontWeight: 700,
                      fontSize: 11.5,
                    }}
                  />
                );
              },
            },
            { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
            { label: "Last login", render: (row) => dateShort(row.lastLoginAt) },
          ]}
          rows={users}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle="No users"
          emptySubtitle="Invite users to give them access to this workspace"
          emptyIcon={<PeopleOutlineIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="outlined" aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}>
                <EditIcon fontSize="small" />
              </Button>
              {row.id !== user.id && (
                <Button size="small" variant="outlined" color="error" onClick={() => void handleToggleActive(row)}>
                  {row.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              )}
            </Stack>
          )}
          actions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New user</Button>
          }
        />
        <FormDialog
          key={editing ? `edit-${editing.id}` : "new"}
          open={createOpen}
          title={editing ? editing.name : "New user"}
          maxWidth="sm"
          fields={
            editing
              ? [
                  { name: "name", label: "Name", required: true, defaultValue: editing.name },
                  { name: "roleId", label: "Role", type: "select", required: true, options: roleOptions, defaultValue: editing.roleId },
                ]
              : [
                  { name: "name", label: "Name", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "password", label: "Password", type: "password", required: true, helper: "At least 8 characters" },
                  { name: "roleId", label: "Role", type: "select", options: roleOptions, defaultValue: employeeRole?.id ?? roleOptions[0]?.value },
                ]
          }
          onSubmit={handleSubmit}
          onClose={() => { setCreateOpen(false); setEditing(null); }}
          submitLabel={editing ? "Save" : "Create user"}
        >
          {editing && (
            <Stack spacing={0.5}>
              <FormControlLabel
                control={<Switch checked={editingActive} onChange={(e) => setEditingActive(e.target.checked)} disabled={editing.id === user.id} />}
                label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>Active</Typography>}
              />
              {editing.id === user.id && (
                <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>You cannot deactivate your own account.</Typography>
              )}
            </Stack>
          )}
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}