"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
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
  const t = useTranslations("inventory");
  const { rows, loading, refresh } = useSimpleList<Warehouse>("/warehouses");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("default"), render: (row) => (row.isDefault ? <StatusChip status="active" /> : "—") },
          { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("emptyWarehousesTitle")}
        emptySubtitle={t("emptyWarehousesSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newWarehouse")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newWarehouse")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "address", label: t("address") },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/warehouses", { method: "POST", body: { name: values.name, address: String(values.address ?? "") } });
            toastSuccess(t("toastWarehouseCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateWarehouse"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("create")}
      />
    </>
  );
}

function BatchesTab() {
  const t = useTranslations("inventory");
  const { rows, loading } = useSimpleList<Batch>("/batches");

  return (
    <DataTable
      columns={[
        { label: t("lot"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.lotNumber}</Typography> },
        { label: t("product"), render: (row) => `#${row.productId.slice(-6)}` },
        { label: t("quantity"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.quantity}</Typography> },
        { label: t("expiry"), render: (row) => dateShort(row.expiryDate) },
        { label: t("received"), render: (row) => dateShort(row.receivedAt) },
      ]}
      rows={rows}
      total={rows.length}
      page={1}
      onPageChange={() => undefined}
      loading={loading}
      emptyTitle={t("emptyBatchesTitle")}
      emptySubtitle={t("emptyBatchesSubtitle")}
    />
  );
}

function TransfersTab() {
  const t = useTranslations("inventory");
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
      toastError(err instanceof Error ? err.message : t("errLoadReferenceData"));
    }
  };

  const receive = async (transfer: Transfer) => {
    const ok = await confirmAction({ title: t("receiveTitle", { referenceNumber: transfer.referenceNumber }), text: t("receiveText"), confirmText: t("receive") });
    if (!ok) return;
    try {
      await api(`/warehouses/transfers/${transfer.id}/receive`, { method: "POST" });
      toastSuccess(t("toastTransferReceived"));
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errReceiveTransfer"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("reference"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.referenceNumber}</Typography> },
          { label: t("from"), render: (row) => `#${row.fromWarehouseId.slice(-6)}` },
          { label: t("to"), render: (row) => `#${row.toWarehouseId.slice(-6)}` },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
          { label: t("created"), render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("emptyTransfersTitle")}
        emptySubtitle={t("emptyTransfersSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newTransfer")}</Button>
        }
        rowActions={(row) =>
          row.status === "in-transit" ? (
            <Tooltip title={t("receive")}>
              <IconButton size="small" color="primary" aria-label={t("receive")} onClick={() => void receive(row)}>
                <MoveToInboxOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          ) : null
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newTransfer")}
        fields={[
          { name: "fromWarehouseId", label: t("fromWarehouse"), type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "toWarehouseId", label: t("toWarehouse"), type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
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
            toastSuccess(t("toastTransferCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateTransfer"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createTransfer")}
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          columns={[
            { key: "productId", label: t("product"), type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: t("qty"), type: "number", required: true },
          ]}
        />
      </FormDialog>
    </>
  );
}

function LowStockTab() {
  const t = useTranslations("inventory");
  const { rows, loading } = useSimpleList<LowStockItem>("/inventory/low-stock");
  const withIds = rows.map((row) => ({ ...row, id: row.productId }));

  return (
    <DataTable
      columns={[
        { label: t("sku"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.sku}</Typography> },
        { label: t("product"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
        { label: t("onHand"), render: (row) => row.quantity },
        { label: t("threshold"), render: (row) => row.threshold },
      ]}
      rows={withIds}
      total={withIds.length}
      page={1}
      onPageChange={() => undefined}
      loading={loading}
      emptyTitle={t("emptyLowStockTitle")}
      emptySubtitle={t("emptyLowStockSubtitle")}
    />
  );
}

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const [tab, setTab] = useState(0);

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
          <Tab label={t("tabWarehouses")} />
          <Tab label={t("tabBatches")} />
          <Tab label={t("tabTransfers")} />
          <Tab label={t("tabLowStock")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <WarehousesTab />}
      {tab === 1 && <BatchesTab />}
      {tab === 2 && <TransfersTab />}
      {tab === 3 && <LowStockTab />}
    </AppShell>
  );
}