"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
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
  const t = useTranslations("platform");
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
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.kind !== "superadmin") {
      toastError(t("noPermissionManageUsers"));
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
          toastError(err instanceof Error ? err.message : t("failedLoadRoles"));
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
    setAvatarDraftUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (row: AdminUserRow) => {
    setEditing(row);
    setEditingActive(row.isActive);
    setDialogCompanyId(row.companyId);
    fetchCompanyRoles(row.companyId);
    setAvatarDraftUrl(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setAvatarDraftUrl(null);
  };

  const handleToggleActive = async (row: AdminUserRow) => {
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
      await api(`/admin/users/${row.id}`, { method: "PATCH", body: { isActive: !row.isActive } });
      toastSuccess(row.isActive ? t("userDeactivated") : t("userReactivated"));
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedUpdateUser"));
    }
  };

  const handleSubmit = async (values: Record<string, string | number>) => {
    const companyId = String(values.companyId ?? "");
    const roleId = String(values.roleId ?? "");
    if (editing && !roleId) {
      toastError(t("selectRoleForCompany"));
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
            ...(avatarDraftUrl ? { avatarUrl: avatarDraftUrl } : {}),
          },
        });
        toastSuccess(t("userUpdated"));
      } else {
        if (String(values.password).length < 8) {
          toastError(t("passwordMinLength"));
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
            ...(avatarDraftUrl ? { avatarUrl: avatarDraftUrl } : {}),
          },
        });
        toastSuccess(t("userCreated"));
      }
      closeDialog();
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedSaveUser"));
    }
  };

  if (!user) return <AppShell><Box /></AppShell>;
  if (user.kind !== "superadmin") return <AppShell><Box /></AppShell>;

  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));
  const systemUserRole = dialogRoles.find((role) => role.isSystem && role.name === "user");
  const roleOptions = dialogRoles.map((role) => ({ value: role.id, label: role.name }));

  const dialogFields: FormField[] = editing
    ? [
        { name: "name", label: t("name"), required: true, defaultValue: editing.name },
        { name: "companyId", label: t("company"), type: "select", required: true, options: companyOptions, defaultValue: editing.companyId },
        {
          name: "roleId",
          label: t("role"),
          type: "select",
          required: true,
          options: roleOptions,
          disabled: !dialogCompanyId || dialogRolesLoading,
        },
      ]
    : [
        { name: "name", label: t("name"), required: true },
        { name: "email", label: t("email"), type: "email", required: true },
        { name: "password", label: t("password"), type: "password", required: true, helper: t("passwordHelper") },
        { name: "companyId", label: t("company"), type: "select", required: true, options: companyOptions },
        {
          name: "roleId",
          label: t("role"),
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
        <PageHeader title={t("pageTitleUsers")} subtitle={t("pageSubtitleUsers")} />
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
          <TextField
            size="small"
            select
            label={t("company")}
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            sx={{ width: 220 }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">{t("allCompanies")}</MenuItem>
            {companyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
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
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{row.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{row.email}</Typography>
                  </Box>
                </Stack>
              ),
            },
            {
              label: t("company"),
              render: (row) => <Typography sx={{ fontSize: 13, color: "#475569" }}>{row.companyName}</Typography>,
            },
            {
              label: t("role"),
              render: (row) => (
                <Chip
                  label={row.roleName}
                  size="small"
                  sx={{ bgcolor: "#ede9fe", color: "#7c3aed", fontWeight: 700, fontSize: 11.5 }}
                />
              ),
            },
            { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
            { label: t("lastLogin"), render: (row) => dateShort(row.lastLoginAt) },
          ]}
          rows={users}
          total={total}
          page={page}
          onPageChange={setPage}
          loading={loading}
          emptyTitle={t("emptyUsersTitle")}
          emptySubtitle={t("emptyUsersSubtitle")}
          emptyIcon={<PeopleOutlineIcon />}
          rowActions={(row) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("editAria", { name: row.name })}>
                <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => openEdit(row)}>
                  <EditOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
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
            </Stack>
          )}
          actions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t("newUser")}</Button>
          }
        />
        <FormDialog
          key={editing ? `edit-${editing.id}` : "new"}
          open={dialogOpen}
          title={editing ? editing.name : t("newUser")}
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
          submitLabel={editing ? t("save") : t("createUser")}
        >
          <Stack spacing={2}>
            <AvatarUpload value={avatarDraftUrl ?? (assetUrl(editing?.avatarUrl) ?? null)} onChange={setAvatarDraftUrl} />
            {editing && (
              <FormControlLabel
                control={<Switch checked={editingActive} onChange={(e) => setEditingActive(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 13.5, color: "#0f172a" }}>{t("active")}</Typography>}
              />
            )}
          </Stack>
        </FormDialog>
      </motion.div>
    </AppShell>
  );
}