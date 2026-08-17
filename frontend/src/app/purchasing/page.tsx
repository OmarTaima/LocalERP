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

type Supplier = { id: string; name: string; contactName: string; email: string; phone: string; isActive: boolean; createdAt: string };
type PurchaseOrder = { id: string; poNumber: string; supplierId: string; items: { productId: string; quantity: number; unitCost: number }[]; expectedDate: string; status: string; total?: number; createdAt: string };
type ApprovalRequest = { id: string; entityType: string; entityId: string; amount: number; status: string; createdAt: string };

const shortId = (id: string): string => id.slice(-6);

function SuppliersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Supplier>("/suppliers");
  const [createOpen, setCreateOpen] = useState(false);

  const remove = async (supplier: Supplier) => {
    const ok = await confirmAction({ title: `Delete ${supplier.name}?`, text: "Suppliers with open purchase orders cannot be deleted.", confirmText: "Delete" });
    if (!ok) return;
    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toastSuccess("Supplier deleted");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to delete supplier");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Contact", render: (row) => row.contactName || "—" },
          { label: "Email", render: (row) => row.email || "—" },
          { label: "Phone", render: (row) => row.phone || "—" },
          { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No suppliers"
        emptySubtitle="Add suppliers to start purchasing"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New supplier</Button>
        }
        rowActions={(row) => (
          <Button size="small" variant="text" color="error" onClick={() => void remove(row)}>Delete</Button>
        )}
      />
      <FormDialog
        open={createOpen}
        title="New supplier"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "contactName", label: "Contact name" },
          { name: "email", label: "Email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address" },
          { name: "paymentTerms", label: "Payment terms" },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/suppliers", {
              method: "POST",
              body: {
                name: values.name,
                contactName: String(values.contactName ?? ""),
                email: String(values.email ?? ""),
                phone: String(values.phone ?? ""),
                address: String(values.address ?? ""),
                paymentTerms: String(values.paymentTerms ?? ""),
              },
            });
            toastSuccess("Supplier created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create supplier");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create supplier"
      />
    </>
  );
}

function PurchaseOrdersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<PurchaseOrder>("/purchase-orders");
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);

  const openCreate = async () => {
    try {
      const [supplierRows, productRows] = await Promise.all([
        api<{ items: Supplier[] }>("/suppliers?page=1&pageSize=100"),
        api<{ items: { id: string; name: string; sku: string }[] }>("/products?page=1&pageSize=100"),
      ]);
      setSuppliers(supplierRows.items);
      setProducts(productRows.items);
      setLines([]);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to load reference data");
    }
  };

  const approve = async (po: PurchaseOrder, approved: boolean) => {
    const ok = await confirmAction({
      title: approved ? `Approve ${po.poNumber}?` : `Reject ${po.poNumber}?`,
      text: approved ? "The supplier is notified and the order becomes active." : "The order is rejected and never sent.",
      confirmText: approved ? "Approve" : "Reject",
    });
    if (!ok) return;
    try {
      await api(`/purchase-orders/${po.id}/approve`, { method: "POST", body: { approved } });
      toastSuccess(approved ? "Purchase order approved" : "Purchase order rejected");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update purchase order");
    }
  };

  const receive = async (po: PurchaseOrder) => {
    const ok = await confirmAction({ title: `Receive ${po.poNumber}?`, text: "A goods receipt note is created and batches are tracked.", confirmText: "Receive goods" });
    if (!ok) return;
    try {
      await api(`/purchase-orders/${po.id}/receive`, { method: "POST" });
      toastSuccess("Goods received");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to receive goods");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "PO", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.poNumber}</Typography> },
          { label: "Supplier", render: (row) => `#${shortId(row.supplierId)}` },
          { label: "Total", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.total ?? row.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0))}</Typography> },
          { label: "Expected", render: (row) => dateShort(row.expectedDate) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No purchase orders"
        emptySubtitle="Orders over $1,000 require approval"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New purchase order</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {row.status === "pending-approval" && (
              <>
                <Button size="small" variant="contained" onClick={() => void approve(row, true)}>Approve</Button>
                <Button size="small" variant="outlined" color="error" onClick={() => void approve(row, false)}>Reject</Button>
              </>
            )}
            {row.status === "sent" && <Button size="small" variant="outlined" onClick={() => void receive(row)}>Receive</Button>}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title="New purchase order"
        fields={[
          { name: "supplierId", label: "Supplier", type: "select", required: true, options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
          { name: "expectedDate", label: "Expected date", type: "date", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/purchase-orders", {
              method: "POST",
              body: {
                supplierId: values.supplierId,
                expectedDate: String(values.expectedDate),
                items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })),
              },
            });
            toastSuccess("Purchase order created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create purchase order");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create PO"
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel="Add line item"
          columns={[
            { key: "productId", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: "Qty", type: "number", required: true },
            { key: "unitCost", label: "Unit cost", type: "number", required: true },
          ]}
        />
      </FormDialog>
    </>
  );
}

function ApprovalsTab() {
  const { rows, total, page, setPage, loading } = useList<ApprovalRequest>("/approval-requests");

  return (
    <DataTable
      columns={[
        { label: "Type", render: (row) => <Typography sx={{ fontWeight: 600, textTransform: "capitalize" }}>{row.entityType}</Typography> },
        { label: "Entity", render: (row) => `#${shortId(row.entityId)}` },
        { label: "Amount", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.amount)}</Typography> },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No approval requests"
      emptySubtitle="Large purchases and sensitive actions create approval requests"
    />
  );
}

export default function PurchasingPage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Purchasing" subtitle="Order supplies from your suppliers and receive them." />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Suppliers" />
          <Tab label="Purchase orders" />
          <Tab label="Approvals" />
        </Tabs>
      </motion.div>
      {tab === 0 && <SuppliersTab />}
      {tab === 1 && <PurchaseOrdersTab />}
      {tab === 2 && <ApprovalsTab />}
    </AppShell>
  );
}