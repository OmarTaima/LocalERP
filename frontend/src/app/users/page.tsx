"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { AvatarUpload } from "@/components/avatar-upload";
import { useList, dateShort } from "@/lib/use-list";
import { api, assetUrl } from "@/lib/api";
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
  const t = useTranslations("users");
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
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && (user.kind !== "company" || !user.permissions.includes("users:read"))) {
      toastError(t("noPermission"));
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
  if (user.kind !== "company" || !user.permissions.includes("users:read")) return <AppShell><Box /></AppShell>;

  const openCreate = () => {
    setEditing(null);
    setAvatarDraftUrl(null);
    setCreateOpen(true);
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setEditingActive(row.isActive);
    setAvatarDraftUrl(null);
    setCreateOpen(true);
  };

  const handleToggleActive = async (row: UserRow) => {
    if (row.isActive) {
      const ok = await confirmAction({
        title: t("deactivateTitle", { name: row.name }),
        text: t("deactivateText"),
        confirmText: t("deactivate"),
        icon: "warning",
      });
      if (!ok) return;
    }
    try {
      await api(`/users/${row.id}`, { method: "PATCH", body: { isActive: !row.isActive } });
      toastSuccess(row.isActive ? t("userDeactivated") : t("userReactivated"));
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUpdateUser"));
    }
  };

  const handleSubmit = async (values: Record<string, string | number>) => {
    if (!editing && String(values.password).length < 8) {
      toastError(t("passwordMinLength"));
      return;
    }
    try {
      if (editing) {
        await api(`/users/${editing.id}`, {
          method: "PATCH",
          body: {
            name: values.name,
            roleId: values.roleId,
            isActive: editingActive,
            ...(avatarDraftUrl ? { avatarUrl: avatarDraftUrl } : {}),
          },
        });
        toastSuccess(t("userUpdated"));
      } else {
        await api("/users", {
          method: "POST",
          body: {
            name: values.name,
            email: values.email,
            password: values.password,
            ...(values.roleId ? { roleId: values.roleId } : {}),
            ...(avatarDraftUrl ? { avatarUrl: avatarDraftUrl } : {}),
          },
        });
        toastSuccess(t("userCreated"));
      }
      setCreateOpen(false);
      setEditing(null);
      setAvatarDraftUrl(null);
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedSaveUser"));
    }
  };

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      </motion.div>
      <motion.div variants={itemVariants}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 240 }}
          />
        </Stack>
        <DataTable
          columns={[
            {
              label: t("user"),
              render: (row) => (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={assetUrl(row.avatarUrl)} sx={{ width: 34, height: 34, bgcolor: "#4f46e5", fontSize: 13, fontWeight: 700 }}>
                    {!row.avatarUrl && row.name.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ paddingInlineStart: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{row.email}</Typography>
                  </Box>
                </Stack>
              ),
            },
            {
              label: t("role"),
              render: (row) => {
                const roleName = roleNameById.get(row.roleId);
                return (
                  <Chip
                    label={roleName ?? t("unknown")}
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
            { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
            { label: t("lastLogin"), render: (row) => dateShort(row.lastLoginAt) },
          ]}
          rows={users}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle={t("emptyTitle")}
          emptySubtitle={t("emptySubtitle")}
          emptyIcon={<PeopleOutlineIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {user.permissions.includes("users:write") && (
                <Tooltip title={t("editAria", { name: row.name })}>
                  <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => openEdit(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
              {user.permissions.includes("users:delete") && row.id !== user.id && (
                <Tooltip title={row.isActive ? t("deactivate") : t("reactivate")}>
                  <IconButton
                    size="small"
                    color={row.isActive ? "error" : "success"}
                    aria-label={row.isActive ? t("deactivate") : t("reactivate")}
                    onClick={() => void handleToggleActive(row)}
                  >
                    {row.isActive ? <BlockIcon sx={{ fontSize: 20 }} /> : <PlayCircleOutlineIcon sx={{ fontSize: 20 }} />}
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
          actions={
            user.permissions.includes("users:create") ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t("newUser")}</Button>
            ) : undefined
          }
        />
        <FormDialog
          key={editing ? `edit-${editing.id}` : "new"}
          open={createOpen}
          title={editing ? editing.name : t("newUser")}
          maxWidth="sm"
          fields={
            editing
              ? [
                  { name: "name", label: t("name"), required: true, defaultValue: editing.name },
                  { name: "roleId", label: t("role"), type: "select", required: true, options: roleOptions, defaultValue: editing.roleId },
                ]
              : [
                  { name: "name", label: t("name"), required: true },
                  { name: "email", label: t("email"), type: "email", required: true },
                  { name: "password", label: t("password"), type: "password", required: true, helper: t("passwordHelper") },
                  { name: "roleId", label: t("role"), type: "select", options: roleOptions, defaultValue: employeeRole?.id ?? roleOptions[0]?.value },
                ]
          }
          onSubmit={handleSubmit}
          onClose={() => { setCreateOpen(false); setEditing(null); setAvatarDraftUrl(null); }}
          submitLabel={editing ? t("save") : t("createUser")}
        >
          <Stack spacing={2}>
            <AvatarUpload value={avatarDraftUrl ?? (assetUrl(editing?.avatarUrl) ?? null)} onChange={setAvatarDraftUrl} />
            {editing && (
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={<Switch checked={editingActive} onChange={(e) => setEditingActive(e.target.checked)} disabled={editing.id === user.id} />}
                  label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>{t("active")}</Typography>}
                />
                {editing.id === user.id && (
                  <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{t("cannotDeactivateSelf")}</Typography>
                )}
              </Stack>
            )}
          </Stack>
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}