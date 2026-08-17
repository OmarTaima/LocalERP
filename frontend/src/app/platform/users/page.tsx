"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import type { FormField } from "@/components/form-dialog";
import { AvatarUpload } from "@/components/avatar-upload";
import { dateShort } from "@/lib/use-list";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  roleId: string;
  roleName: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
};

type CompanyOption = { id: string; name: string };
type CompanyRole = { id: string; name: string; permissions: string[]; isSystem: boolean };

const PAGE_SIZE = 20;

export default function PlatformUsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editingActive, setEditingActive] = useState(true);
  const [dialogCompanyId, setDialogCompanyId] = useState("");
  const [dialogRoles, setDialogRoles] = useState<CompanyRole[]>([]);
  const [dialogRolesLoading, setDialogRolesLoading] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.kind !== "superadmin") {
      toastError("You don't have permission to manage users");
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    void api<{ items: CompanyOption[]; total: number }>("/admin/companies?page=1&pageSize=100")
      .then((res) => setCompanies(res.items))
      .catch(() => setCompanies([]));
  }, []);

  const fetchData = useCallback(
    (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (companyFilter) params.set("companyId", companyFilter);
      api<{ items: AdminUserRow[]; total: number }>("/admin/users?" + params.toString())
        .then((res) => {
          setUsers(res.items);
          setTotal(res.total);
        })
        .catch(() => {
          setUsers([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    },
    [search, companyFilter],
  );

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    fetchData(1);
  }, [search, companyFilter, page, fetchData]);

  const rolesRequestRef = useRef(0);

  const fetchCompanyRoles = useCallback((companyId: string) => {
    const requestId = ++rolesRequestRef.current;
    if (!companyId) {
      setDialogRoles([]);
      setDialogRolesLoading(false);
      return;
    }
    setDialogRolesLoading(true);
    setDialogRoles([]);
    api<CompanyRole[]>(`/admin/companies/${companyId}/roles`)
      .then((roles) => {
        if (rolesRequestRef.current === requestId) setDialogRoles(roles);
      })
      .catch((err) => {
        if (rolesRequestRef.current === requestId) {
          setDialogRoles([]);
          toastError(err instanceof Error ? err.message : "Failed to load roles");
        }
      })
      .finally(() => {
        if (rolesRequestRef.current === requestId) setDialogRolesLoading(false);
      });
  }, []);

  const handleDialogFieldChange = (values: Record<string, string | number>) => {
    const companyId = String(values.companyId ?? "");
    if (companyId !== dialogCompanyId) {
      setDialogCompanyId(companyId);
      fetchCompanyRoles(companyId);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setEditingActive(true);
    setDialogCompanyId("");
    setDialogRoles([]);
    setDialogRolesLoading(false);
    setAvatarDraft(null);
    setDialogOpen(true);
  };

  const openEdit = (row: AdminUserRow) => {
    setEditing(row);
    setEditingActive(row.isActive);
    setDialogCompanyId(row.companyId);
    fetchCompanyRoles(row.companyId);
    setAvatarDraft(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setAvatarDraft(null);
  };

  const handleToggleActive = async (row: AdminUserRow) => {
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
      await api(`/admin/users/${row.id}`, { method: "PATCH", body: { isActive: !row.isActive } });
      toastSuccess(row.isActive ? "User deactivated" : "User reactivated");
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleSubmit = async (values: Record<string, string | number>) => {
    const companyId = String(values.companyId ?? "");
    const roleId = String(values.roleId ?? "");
    if (editing && !roleId) {
      toastError("Please select a role for this company");
      return;
    }
    try {
      if (editing) {
        await api(`/admin/users/${editing.id}`, {
          method: "PATCH",
          body: {
            name: values.name,
            companyId,
            ...(roleId ? { roleId } : {}),
            isActive: editingActive,
            ...(avatarDraft ? { avatarBase64: avatarDraft } : {}),
          },
        });
        toastSuccess("User updated");
      } else {
        if (String(values.password).length < 8) {
          toastError("Password must be at least 8 characters");
          return;
        }
        await api("/admin/users", {
          method: "POST",
          body: {
            name: values.name,
            email: values.email,
            password: values.password,
            companyId,
            ...(roleId ? { roleId } : {}),
            ...(avatarDraft ? { avatarBase64: avatarDraft } : {}),
          },
        });
        toastSuccess("User created");
      }
      closeDialog();
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save user");
    }
  };

  if (!user) return <AppShell><Box /></AppShell>;
  if (user.kind !== "superadmin") return <AppShell><Box /></AppShell>;

  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));
  const systemUserRole = dialogRoles.find((role) => role.isSystem && role.name === "user");
  const roleOptions = dialogRoles.map((role) => ({ value: role.id, label: role.name }));

  const dialogFields: FormField[] = editing
    ? [
        { name: "name", label: "Name", required: true, defaultValue: editing.name },
        { name: "companyId", label: "Company", type: "select", required: true, options: companyOptions, defaultValue: editing.companyId },
        {
          name: "roleId",
          label: "Role",
          type: "select",
          required: true,
          options: roleOptions,
          disabled: !dialogCompanyId || dialogRolesLoading,
        },
      ]
    : [
        { name: "name", label: "Name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "password", label: "Password", type: "password", required: true, helper: "At least 8 characters" },
        { name: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        {
          name: "roleId",
          label: "Role",
          type: "select",
          required: true,
          options: roleOptions,
          defaultValue: systemUserRole?.id ?? "",
          disabled: !dialogCompanyId || dialogRolesLoading,
        },
      ];

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Users" subtitle="Create and manage user accounts in every workspace." />
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
          <TextField
            size="small"
            select
            label="Company"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            sx={{ width: 220 }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">All companies</MenuItem>
            {companyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
        <DataTable
          columns={[
            {
              label: "User",
              render: (row) => (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={assetUrl(row.avatarUrl)} sx={{ width: 34, height: 34, bgcolor: "#4f46e5", fontSize: 13, fontWeight: 700 }}>
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
              label: "Company",
              render: (row) => <Typography sx={{ fontSize: 13, color: "#475569" }}>{row.companyName}</Typography>,
            },
            {
              label: "Role",
              render: (row) => (
                <Chip
                  label={row.roleName}
                  size="small"
                  sx={{ bgcolor: "#ede9fe", color: "#7c3aed", fontWeight: 700, fontSize: 11.5 }}
                />
              ),
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
          emptySubtitle="User accounts across every workspace appear here"
          emptyIcon={<PeopleOutlineIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="outlined" aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}>
                <EditIcon fontSize="small" />
              </Button>
              <Button size="small" variant="outlined" color="error" onClick={() => void handleToggleActive(row)}>
                {row.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </Stack>
          )}
          actions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New user</Button>
          }
        />
        <FormDialog
          key={editing ? `edit-${editing.id}` : "new"}
          open={dialogOpen}
          title={editing ? editing.name : "New user"}
          maxWidth="sm"
          fields={dialogFields}
          initialValues={
            editing
              ? { name: editing.name, companyId: editing.companyId, roleId: editing.roleId }
              : undefined
          }
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onFieldChange={handleDialogFieldChange}
          submitLabel={editing ? "Save" : "Create user"}
        >
          <Stack spacing={2}>
            <AvatarUpload value={avatarDraft ?? (assetUrl(editing?.avatarUrl) ?? null)} onChange={setAvatarDraft} />
            {editing && (
              <FormControlLabel
                control={<Switch checked={editingActive} onChange={(e) => setEditingActive(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>Active</Typography>}
              />
            )}
          </Stack>
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}