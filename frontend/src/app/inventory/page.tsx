"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { useList, useSimpleList, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type Warehouse = { id: string; name: string; address?: string; isDefault: boolean; isActive: boolean };
type Batch = { id: string; lotNumber: string; productId: string; quantity: number; expiryDate: string | null; supplierId: string | null; receivedAt: string };
type Transfer = { id: string; referenceNumber: string; fromWarehouseId: string; toWarehouseId: string; status: string; createdAt: string };
type LowStockItem = { productId: string; sku: string; name: string; quantity: number; threshold: number };

function WarehousesTab() {
  const { rows, loading, refresh } = useSimpleList<Warehouse>("/warehouses");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Default", render: (row) => (row.isDefault ? <StatusChip status="active" /> : "—") },
          { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No warehouses"
        emptySubtitle="Create a warehouse to hold stock"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New warehouse</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New warehouse"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "address", label: "Address" },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/warehouses", { method: "POST", body: { name: values.name, address: String(values.address ?? "") } });
            toastSuccess("Warehouse created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create warehouse");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create"
      />
    </>
  );
}

function BatchesTab() {
  const { rows, loading } = useSimpleList<Batch>("/batches");

  return (
    <DataTable
      columns={[
        { label: "Lot", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.lotNumber}</Typography> },
        { label: "Product", render: (row) => `#${row.productId.slice(-6)}` },
        { label: "Quantity", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.quantity}</Typography> },
        { label: "Expiry", render: (row) => dateShort(row.expiryDate) },
        { label: "Received", render: (row) => dateShort(row.receivedAt) },
      ]}
      rows={rows}
      total={rows.length}
      page={1}
      onPageChange={() => undefined}
      loading={loading}
      emptyTitle="No batches"
      emptySubtitle="Batches are created by GRNs, transfers, and work orders"
    />
  );
}

function TransfersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Transfer>("/warehouses/transfers");
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);

  const openCreate = async () => {
    try {
      const [warehouseRows, productRows] = await Promise.all([api<Warehouse[]>("/warehouses"), api<{ items: { id: string; name: string; sku: string }[] }>("/products?page=1&pageSize=100")]);
      setWarehouses(warehouseRows);
      setProducts(productRows.items);
      setLines([]);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to load reference data");
    }
  };

  const receive = async (transfer: Transfer) => {
    const ok = await confirmAction({ title: `Receive ${transfer.referenceNumber}?`, text: "Stock is added to the destination warehouse.", confirmText: "Receive" });
    if (!ok) return;
    try {
      await api(`/warehouses/transfers/${transfer.id}/receive`, { method: "POST" });
      toastSuccess("Transfer received");
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to receive transfer");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Reference", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.referenceNumber}</Typography> },
          { label: "From", render: (row) => `#${row.fromWarehouseId.slice(-6)}` },
          { label: "To", render: (row) => `#${row.toWarehouseId.slice(-6)}` },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
          { label: "Created", render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No transfers"
        emptySubtitle="Move stock between warehouses"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New transfer</Button>
        }
        rowActions={(row) =>
          row.status === "in-transit" ? <Button size="small" variant="outlined" onClick={() => void receive(row)}>Receive</Button> : null
        }
      />
      <FormDialog
        open={createOpen}
        title="New transfer"
        fields={[
          { name: "fromWarehouseId", label: "From warehouse", type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "toWarehouseId", label: "To warehouse", type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/warehouses/transfer", {
              method: "POST",
              body: {
                fromWarehouseId: values.fromWarehouseId,
                toWarehouseId: values.toWarehouseId,
                items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
              },
            });
            toastSuccess("Transfer created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create transfer");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create transfer"
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          columns={[
            { key: "productId", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: "Qty", type: "number", required: true },
          ]}
        />
      </FormDialog>
    </>
  );
}

function LowStockTab() {
  const { rows, loading } = useSimpleList<LowStockItem>("/inventory/low-stock");
  const withIds = rows.map((row) => ({ ...row, id: row.productId }));

  return (
    <DataTable
      columns={[
        { label: "SKU", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.sku}</Typography> },
        { label: "Product", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
        { label: "On hand", render: (row) => row.quantity },
        { label: "Threshold", render: (row) => row.threshold },
      ]}
      rows={withIds}
      total={withIds.length}
      page={1}
      onPageChange={() => undefined}
      loading={loading}
      emptyTitle="All products in stock"
      emptySubtitle="No products are below their reorder threshold"
    />
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Inventory" subtitle="Warehouses, batches, transfers and stock levels" />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Warehouses" />
          <Tab label="Batches" />
          <Tab label="Transfers" />
          <Tab label="Low stock" />
        </Tabs>
      </motion.div>
      {tab === 0 && <WarehousesTab />}
      {tab === 1 && <BatchesTab />}
      {tab === 2 && <TransfersTab />}
      {tab === 3 && <LowStockTab />}
    </AppShell>
  );
}