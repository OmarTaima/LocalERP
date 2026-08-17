"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type WorkCenter = { id: string; name: string; costPerHour: number; capacity: number; isActive: boolean };
type Bom = { id: string; productId: string; components: { productId: string; quantity: number }[]; outputQuantity: number; version: number; createdAt: string };
type WorkOrder = { id: string; woNumber: string; productId: string; quantity: number; plannedHours: number; status: string; unitCost: number; createdAt: string };
type MrpSuggestion = { id: string; productId: string; warehouseId: string; type: string; quantity: number; status: string; createdAt: string };

function WorkCentersTab() {
  const [rows, setRows] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

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
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Cost / hour", render: (row) => currency(row.costPerHour) },
          { label: "Capacity", render: (row) => row.capacity },
          { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No work centers"
        emptySubtitle="Work centers carry labor costs for work orders"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New work center</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New work center"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "costPerHour", label: "Cost per hour", type: "number", required: true },
          { name: "capacity", label: "Capacity (units/hour)", type: "number", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/work-centers", {
              method: "POST",
              body: { name: values.name, costPerHour: Number(values.costPerHour), capacity: Number(values.capacity) },
            });
            toastSuccess("Work center created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create work center");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create"
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
      toastError(err instanceof Error ? err.message : "failed to load products");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Product", render: (row) => `#${row.productId.slice(-6)}` },
          { label: "Components", render: (row) => `${row.components.length} components` },
          { label: "Output", render: (row) => row.outputQuantity },
          { label: "Version", render: (row) => `v${row.version}` },
          { label: "Created", render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No BOMs"
        emptySubtitle="Define how finished goods are assembled"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New BOM</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New bill of materials"
        fields={[
          { name: "productId", label: "Finished good", type: "select", required: true, options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "outputQuantity", label: "Output quantity", type: "number", required: true, defaultValue: 1 },
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
            toastSuccess("BOM created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create BOM");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create BOM"
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel="Add component"
          columns={[
            { key: "productId", label: "Component", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: "Qty per output", type: "number", required: true },
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

  const openCreate = async () => {
    try {
      const [bomRows, centerRows] = await Promise.all([api<Bom[]>("/boms"), api<WorkCenter[]>("/work-centers")]);
      setBoms(bomRows);
      setWorkCenters(centerRows);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to load reference data");
    }
  };

  const transition = async (wo: WorkOrder, action: "start" | "complete" | "cancel") => {
    const ok = await confirmAction({
      title: `${action} ${wo.woNumber}?`,
      text: action === "start" ? "Materials are consumed from the default warehouse." : action === "complete" ? "Finished goods are batched and journaled." : "The order is cancelled.",
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
    });
    if (!ok) return;
    try {
      await api(`/work-orders/${wo.id}/${action}`, { method: "POST" });
      toastSuccess(`${wo.woNumber} ${action}ed`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : `failed to ${action} work order`);
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "WO", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.woNumber}</Typography> },
          { label: "Product", render: (row) => `#${row.productId.slice(-6)}` },
          { label: "Quantity", render: (row) => row.quantity },
          { label: "Planned hours", render: (row) => row.plannedHours },
          { label: "Unit cost", render: (row) => (row.unitCost > 0 ? currency(row.unitCost) : "—") },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No work orders"
        emptySubtitle="Release production through work orders"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New work order</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {row.status === "draft" && <Button size="small" variant="contained" onClick={() => void transition(row, "start")}>Start</Button>}
            {row.status === "in-progress" && <Button size="small" variant="contained" onClick={() => void transition(row, "complete")}>Complete</Button>}
            {(row.status === "draft" || row.status === "released") && <Button size="small" variant="outlined" color="error" onClick={() => void transition(row, "cancel")}>Cancel</Button>}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title="New work order"
        fields={[
          { name: "bomId", label: "BOM", type: "select", required: true, options: boms.map((b) => ({ value: b.id, label: `${b.productId.slice(-6)} (output ${b.outputQuantity})` })) },
          { name: "workCenterId", label: "Work center", type: "select", required: true, options: workCenters.map((c) => ({ value: c.id, label: c.name })) },
          { name: "quantity", label: "Quantity", type: "number", required: true },
          { name: "plannedHours", label: "Planned hours", type: "number", required: true },
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
            toastSuccess("Work order created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create work order");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create WO"
      />
    </>
  );
}

function MrpTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<MrpSuggestion>("/mrp/suggestions");

  const act = async (suggestion: MrpSuggestion, status: "actioned" | "dismissed") => {
    const ok = await confirmAction({
      title: status === "actioned" ? "Action this suggestion?" : "Dismiss this suggestion?",
      text: status === "actioned" ? "Purchase suggestions become POs; produce suggestions become work orders." : "It will be removed from the queue.",
      confirmText: status === "actioned" ? "Action" : "Dismiss",
    });
    if (!ok) return;
    try {
      await api(`/mrp/suggestions/${suggestion.id}/action`, { method: "POST", body: { status } });
      toastSuccess(`Suggestion ${status}`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update suggestion");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "Type", render: (row) => <Typography sx={{ fontWeight: 600, textTransform: "capitalize", color: "#4f46e5" }}>{row.type}</Typography> },
        { label: "Product", render: (row) => `#${row.productId.slice(-6)}` },
        { label: "Warehouse", render: (row) => `#${row.warehouseId.slice(-6)}` },
        { label: "Quantity", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.quantity}</Typography> },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No MRP suggestions"
      emptySubtitle="Run MRP to detect shortage gaps"
      rowActions={(row) =>
        row.status === "open" ? (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="contained" onClick={() => void act(row, "actioned")}>Action</Button>
            <Button size="small" variant="outlined" onClick={() => void act(row, "dismissed")}>Dismiss</Button>
          </Stack>
        ) : null
      }
    />
  );
}

export default function ManufacturingPage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Manufacturing" subtitle="Bills of materials, work centers, work orders and MRP" />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Work orders" />
          <Tab label="BOMs" />
          <Tab label="Work centers" />
          <Tab label="MRP suggestions" />
        </Tabs>
      </motion.div>
      {tab === 0 && <WorkOrdersTab />}
      {tab === 1 && <BomsTab />}
      {tab === 2 && <WorkCentersTab />}
      {tab === 3 && <MrpTab />}
    </AppShell>
  );
}