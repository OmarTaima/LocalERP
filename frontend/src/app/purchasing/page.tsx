"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
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
  const t = useTranslations("purchasing");
  const { rows, total, page, setPage, loading, refresh } = useList<Supplier>("/suppliers");
  const [createOpen, setCreateOpen] = useState(false);

  const remove = async (supplier: Supplier) => {
    const ok = await confirmAction({ title: t("deleteSupplierTitle", { name: supplier.name }), text: t("deleteSupplierText"), confirmText: t("delete") });
    if (!ok) return;
    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toastSuccess(t("toastSupplierDeleted"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errDeleteSupplier"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("contact"), render: (row) => row.contactName || "—" },
          { label: t("email"), render: (row) => row.email || "—" },
          { label: t("phone"), render: (row) => row.phone || "—" },
          { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("emptySuppliersTitle")}
        emptySubtitle={t("emptySuppliersSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newSupplier")}</Button>
        }
        rowActions={(row) => (
          <Tooltip title={t("delete")}>
            <IconButton size="small" color="error" aria-label={t("delete")} onClick={() => void remove(row)}>
              <DeleteOutlineIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      />
      <FormDialog
        open={createOpen}
        title={t("newSupplier")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "contactName", label: t("contactName") },
          { name: "email", label: t("email") },
          { name: "phone", label: t("phone") },
          { name: "address", label: t("address") },
          { name: "paymentTerms", label: t("paymentTerms") },
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
            toastSuccess(t("toastSupplierCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateSupplier"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createSupplier")}
      />
    </>
  );
}

function PurchaseOrdersTab() {
  const t = useTranslations("purchasing");
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
      toastError(err instanceof Error ? err.message : t("errLoadReferenceData"));
    }
  };

  const approve = async (po: PurchaseOrder, approved: boolean) => {
    const ok = await confirmAction({
      title: t(approved ? "approveTitle" : "rejectTitle", { poNumber: po.poNumber }),
      text: t(approved ? "approveText" : "rejectText"),
      confirmText: t(approved ? "approve" : "reject"),
    });
    if (!ok) return;
    try {
      await api(`/purchase-orders/${po.id}/approve`, { method: "POST", body: { approved } });
      toastSuccess(t(approved ? "toastPoApproved" : "toastPoRejected"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errUpdatePo"));
    }
  };

  const receive = async (po: PurchaseOrder) => {
    const ok = await confirmAction({ title: t("receiveTitle", { poNumber: po.poNumber }), text: t("receiveText"), confirmText: t("receiveGoods") });
    if (!ok) return;
    try {
      await api(`/purchase-orders/${po.id}/receive`, { method: "POST" });
      toastSuccess(t("toastGoodsReceived"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errReceiveGoods"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("po"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.poNumber}</Typography> },
          { label: t("supplier"), render: (row) => `#${shortId(row.supplierId)}` },
          { label: t("total"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.total ?? row.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0))}</Typography> },
          { label: t("expected"), render: (row) => dateShort(row.expectedDate) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("emptyPoTitle")}
        emptySubtitle={t("emptyPoSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newPo")}</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {row.status === "pending-approval" && (
              <>
                <Tooltip title={t("approve")}>
                  <IconButton size="small" color="success" aria-label={t("approve")} onClick={() => void approve(row, true)}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("reject")}>
                  <IconButton size="small" color="error" aria-label={t("reject")} onClick={() => void approve(row, false)}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {row.status === "sent" && (
              <Tooltip title={t("receive")}>
                <IconButton size="small" color="primary" aria-label={t("receive")} onClick={() => void receive(row)}>
                  <MoveToInboxOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title={t("newPo")}
        fields={[
          { name: "supplierId", label: t("supplier"), type: "select", required: true, options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
          { name: "expectedDate", label: t("expectedDate"), type: "date", required: true },
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
            toastSuccess(t("toastPoCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreatePo"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createPo")}
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel={t("addLineItem")}
          columns={[
            { key: "productId", label: t("product"), type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: t("qty"), type: "number", required: true },
            { key: "unitCost", label: t("unitCost"), type: "number", required: true },
          ]}
        />
      </FormDialog>
    </>
  );
}

function ApprovalsTab() {
  const t = useTranslations("purchasing");
  const { rows, total, page, setPage, loading } = useList<ApprovalRequest>("/approval-requests");

  return (
    <DataTable
      columns={[
        { label: t("type"), render: (row) => <Typography sx={{ fontWeight: 600, textTransform: "capitalize" }}>{row.entityType}</Typography> },
        { label: t("entity"), render: (row) => `#${shortId(row.entityId)}` },
        { label: t("amount"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.amount)}</Typography> },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("emptyApprovalsTitle")}
      emptySubtitle={t("emptyApprovalsSubtitle")}
    />
  );
}

export default function PurchasingPage() {
  const t = useTranslations("purchasing");
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
          <Tab label={t("tabSuppliers")} />
          <Tab label={t("tabPurchaseOrders")} />
          <Tab label={t("tabApprovals")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <SuppliersTab />}
      {tab === 1 && <PurchaseOrdersTab />}
      {tab === 2 && <ApprovalsTab />}
    </AppShell>
  );
}