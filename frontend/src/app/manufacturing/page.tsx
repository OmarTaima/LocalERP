"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

type WorkCenter = { id: string; name: string; costPerHour: number; capacity: number; isActive: boolean };
type Bom = { id: string; productId: string; components: { productId: string; quantity: number }[]; outputQuantity: number; version: number; createdAt: string };
type WorkOrder = { id: string; woNumber: string; productId: string; quantity: number; plannedHours: number; status: string; unitCost: number; createdAt: string };
type MrpSuggestion = { id: string; productId: string; warehouseId: string; type: string; quantity: number; status: string; createdAt: string };

function WorkCentersTab() {
  const [rows, setRows] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("manufacturing");

  const refresh = () => {
    setLoading(true);
    api<WorkCenter[]>("/work-centers")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("costPerHourColumn"), render: (row) => currency(row.costPerHour) },
          { label: t("capacity"), render: (row) => row.capacity },
          { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("workCenterEmptyTitle")}
        emptySubtitle={t("workCenterEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newWorkCenter")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newWorkCenter")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "costPerHour", label: t("costPerHour"), type: "number", required: true },
          { name: "capacity", label: t("capacityPerHour"), type: "number", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/work-centers", {
              method: "POST",
              body: { name: values.name, costPerHour: Number(values.costPerHour), capacity: Number(values.capacity) },
            });
            toastSuccess(t("workCenterCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("workCenterCreateFailed"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("create")}
      />
    </>
  );
}

function BomsTab() {
  const [rows, setRows] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const t = useTranslations("manufacturing");

  const refresh = () => {
    setLoading(true);
    api<Bom[]>("/boms")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  const openCreate = async () => {
    try {
      const productRows = await api<{ items: { id: string; name: string; sku: string }[] }>("/products?page=1&pageSize=100");
      setProducts(productRows.items);
      setLines([]);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("referenceDataLoadFailed"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("product"), render: (row) => `#${row.productId.slice(-6)}` },
          { label: t("bomColumnComponents"), render: (row) => t("componentsCount", { count: row.components.length }) },
          { label: t("bomColumnOutput"), render: (row) => row.outputQuantity },
          { label: t("bomColumnVersion"), render: (row) => `v${row.version}` },
          { label: t("created"), render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("bomEmptyTitle")}
        emptySubtitle={t("bomEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newBom")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("bomDialogTitle")}
        fields={[
          { name: "productId", label: t("finishedGood"), type: "select", required: true, options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "outputQuantity", label: t("outputQuantity"), type: "number", required: true, defaultValue: 1 },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/boms", {
              method: "POST",
              body: {
                productId: values.productId,
                outputQuantity: Number(values.outputQuantity),
                components: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
              },
            });
            toastSuccess(t("bomCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("bomCreateFailed"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createBom")}
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel={t("addComponent")}
          columns={[
            { key: "productId", label: t("component"), type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: t("qtyPerOutput"), type: "number", required: true },
          ]}
        />
      </FormDialog>
    </>
  );
}

function WorkOrdersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<WorkOrder>("/work-orders");
  const [createOpen, setCreateOpen] = useState(false);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const t = useTranslations("manufacturing");

  const openCreate = async () => {
    try {
      const [bomRows, centerRows] = await Promise.all([api<Bom[]>("/boms"), api<WorkCenter[]>("/work-centers")]);
      setBoms(bomRows);
      setWorkCenters(centerRows);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("referenceDataLoadFailed"));
    }
  };

  const transition = async (wo: WorkOrder, action: "start" | "complete" | "cancel") => {
    const ok = await confirmAction({
      title: action === "start" ? t("woStartTitle", { wo: wo.woNumber }) : action === "complete" ? t("woCompleteTitle", { wo: wo.woNumber }) : t("woCancelTitle", { wo: wo.woNumber }),
      text: action === "start" ? t("woStartText") : action === "complete" ? t("woCompleteText") : t("woCancelText"),
      confirmText: action === "start" ? t("start") : action === "complete" ? t("complete") : t("cancel"),
    });
    if (!ok) return;
    try {
      await api(`/work-orders/${wo.id}/${action}`, { method: "POST" });
      toastSuccess(action === "start" ? t("woStarted", { wo: wo.woNumber }) : action === "complete" ? t("woCompleted", { wo: wo.woNumber }) : t("woCanceled", { wo: wo.woNumber }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : action === "start" ? t("woStartFailed") : action === "complete" ? t("woCompleteFailed") : t("woCancelFailed"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("woColumnWo"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.woNumber}</Typography> },
          { label: t("product"), render: (row) => `#${row.productId.slice(-6)}` },
          { label: t("quantity"), render: (row) => row.quantity },
          { label: t("woColumnPlannedHours"), render: (row) => row.plannedHours },
          { label: t("woColumnUnitCost"), render: (row) => (row.unitCost > 0 ? currency(row.unitCost) : "—") },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("workOrderEmptyTitle")}
        emptySubtitle={t("workOrderEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newWorkOrder")}</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {row.status === "draft" && (
              <Tooltip title={t("start")}>
                <IconButton size="small" color="primary" aria-label={t("start")} onClick={() => void transition(row, "start")}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            {row.status === "in-progress" && (
              <Tooltip title={t("complete")}>
                <IconButton size="small" color="success" aria-label={t("complete")} onClick={() => void transition(row, "complete")}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            {(row.status === "draft" || row.status === "released") && (
              <Tooltip title={t("cancel")}>
                <IconButton size="small" color="error" aria-label={t("cancel")} onClick={() => void transition(row, "cancel")}>
                  <BlockIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title={t("newWorkOrder")}
        fields={[
          { name: "bomId", label: t("bom"), type: "select", required: true, options: boms.map((b) => ({ value: b.id, label: t("bomOption", { id: b.productId.slice(-6), output: b.outputQuantity }) })) },
          { name: "workCenterId", label: t("workCenter"), type: "select", required: true, options: workCenters.map((c) => ({ value: c.id, label: c.name })) },
          { name: "quantity", label: t("quantity"), type: "number", required: true },
          { name: "plannedHours", label: t("woColumnPlannedHours"), type: "number", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/work-orders", {
              method: "POST",
              body: {
                bomId: values.bomId,
                workCenterId: values.workCenterId,
                quantity: Number(values.quantity),
                plannedHours: Number(values.plannedHours),
              },
            });
            toastSuccess(t("workOrderCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("workOrderCreateFailed"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createWo")}
      />
    </>
  );
}

function MrpTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<MrpSuggestion>("/mrp/suggestions");
  const t = useTranslations("manufacturing");

  const act = async (suggestion: MrpSuggestion, status: "actioned" | "dismissed") => {
    const ok = await confirmAction({
      title: status === "actioned" ? t("mrpActionTitle") : t("mrpDismissTitle"),
      text: status === "actioned" ? t("mrpActionText") : t("mrpDismissText"),
      confirmText: status === "actioned" ? t("action") : t("dismiss"),
    });
    if (!ok) return;
    try {
      await api(`/mrp/suggestions/${suggestion.id}/action`, { method: "POST", body: { status } });
      toastSuccess(status === "actioned" ? t("mrpActioned") : t("mrpDismissed"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("mrpUpdateFailed"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("mrpColumnType"), render: (row) => <Typography sx={{ fontWeight: 600, textTransform: "capitalize", color: "#4f46e5" }}>{row.type}</Typography> },
        { label: t("product"), render: (row) => `#${row.productId.slice(-6)}` },
        { label: t("mrpColumnWarehouse"), render: (row) => `#${row.warehouseId.slice(-6)}` },
        { label: t("quantity"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.quantity}</Typography> },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("mrpEmptyTitle")}
      emptySubtitle={t("mrpEmptySubtitle")}
      rowActions={(row) =>
        row.status === "open" ? (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("action")}>
              <IconButton size="small" color="primary" aria-label={t("action")} onClick={() => void act(row, "actioned")}>
                <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("dismiss")}>
              <IconButton size="small" color="error" aria-label={t("dismiss")} onClick={() => void act(row, "dismissed")}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null
      }
    />
  );
}

export default function ManufacturingPage() {
  const [tab, setTab] = useState(0);
  const t = useTranslations("manufacturing");

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label={t("tabWorkOrders")} />
          <Tab label={t("tabBoms")} />
          <Tab label={t("tabWorkCenters")} />
          <Tab label={t("tabMrpSuggestions")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <WorkOrdersTab />}
      {tab === 1 && <BomsTab />}
      {tab === 2 && <WorkCentersTab />}
      {tab === 3 && <MrpTab />}
    </AppShell>
  );
}