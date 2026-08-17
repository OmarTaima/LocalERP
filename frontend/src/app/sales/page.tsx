"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import CloseIcon from "@mui/icons-material/Close";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
import CurrencyExchangeRoundedIcon from "@mui/icons-material/CurrencyExchangeRounded";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type Customer = { id: string; name: string; email: string; phone: string; creditLimit: number; totalSpent: number; status: string; createdAt: string };
type OrderItem = { productId: string; name: string; sku: string; quantity: number; unitPrice: number; taxRate: number };
type ReturnableOrder = { id: string; orderNumber: string; items: OrderItem[] };
type Order = { id: string; orderNumber: string; customerId: string; items: OrderItem[]; totals: { total: number }; status: string; createdAt: string };
type Quote = { id: string; quoteNumber: string; customerId: string; totals: { total: number }; status: string; validUntil: string };
type Shipment = { id: string; orderId: string; carrier: string; trackingNumber: string; status: string; createdAt: string };
type Rma = { id: string; rmaNumber: string; orderId: string; reason: string; status: string; createdAt: string };
type Recurring = { id: string; customerId: string; interval: string; status: string; createdAt: string };

const shortId = (id: string): string => id.slice(-6);

function CustomersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Customer>("/customers");
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("sales");

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("email"), render: (row) => row.email },
          { label: t("phone"), render: (row) => row.phone || "—" },
          { label: t("creditLimit"), render: (row) => currency(row.creditLimit) },
          { label: t("totalSpent"), render: (row) => currency(row.totalSpent) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
          { label: t("created"), render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("customersEmptyTitle")}
        emptySubtitle={t("customersEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newCustomer")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newCustomer")}
        subtitle={t("newCustomerSubtitle")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "email", label: t("email"), required: true },
          { name: "phone", label: t("phone") },
          { name: "creditLimit", label: t("creditLimitField"), type: "number", defaultValue: 0 },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/customers", { method: "POST", body: { name: values.name, email: values.email, phone: String(values.phone ?? ""), creditLimit: Number(values.creditLimit ?? 0) } });
            toastSuccess(t("customerCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorCreateCustomer"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createCustomer")}
      />
    </>
  );
}

function OrdersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Order>("/orders");
  const [payFor, setPayFor] = useState<Order | null>(null);
  const [returnFor, setReturnFor] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const t = useTranslations("sales");

  const openCreate = async () => {
    try {
      const [customerRows, productRows] = await Promise.all([
        api<{ items: Customer[] }>("/customers?page=1&pageSize=100"),
        api<{ items: { id: string; name: string; sku: string }[] }>("/products?page=1&pageSize=100"),
      ]);
      setCustomers(customerRows.items);
      setProducts(productRows.items);
      setLines([]);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorLoadReferenceData"));
    }
  };

  const advance = async (order: Order, status: string) => {
    const ok = await confirmAction({ title: t("markOrderAs", { order: order.orderNumber, status }), text: t("markOrderText"), confirmText: t("updateStatus") });
    if (!ok) return;
    try {
      await api(`/orders/${order.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(t("orderNowStatus", { order: order.orderNumber, status }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateStatus"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("order"), render: (row) => (
            <Link href={`/sales/orders/${row.id}`} aria-label={t("viewOrder", { number: row.orderNumber })} style={{ fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}>
              {row.orderNumber}
            </Link>
          ) },
          { label: t("customer"), render: (row) => `#${shortId(row.customerId)}` },
          { label: t("total"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.totals.total)}</Typography> },
          { label: t("items"), render: (row) => {
            const qty = row.items.reduce((sum, item) => sum + item.quantity, 0);
            return row.items.length > 1 ? t("itemsColumn", { qty, lines: row.items.length }) : t("itemsSingle", { qty });
          } },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
          { label: t("created"), render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("ordersEmptyTitle")}
        emptySubtitle={t("ordersEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newOrder")}</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {row.status === "draft" && (
              <Tooltip title={t("confirm")}>
                <IconButton size="small" aria-label={t("confirm")} onClick={() => void advance(row, "confirmed")}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            {row.status === "confirmed" && (
              <Tooltip title={t("capturePayment")}>
                <IconButton size="small" color="primary" aria-label={t("capturePayment")} onClick={() => setPayFor(row)}>
                  <PaymentsOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            {(row.status === "shipped" || row.status === "delivered") && (
              <Tooltip title={t("return")}>
                <IconButton size="small" color="warning" aria-label={t("return")} onClick={() => setReturnFor(row)}>
                  <AssignmentReturnOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title={t("newOrder")}
        subtitle={t("newOrderSubtitle")}
        fields={[
          { name: "customerId", label: t("customer"), type: "select", required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
          { name: "label", label: t("addressLabel"), required: true, defaultValue: "Main" },
          { name: "street", label: t("street"), required: true },
          { name: "city", label: t("city"), required: true },
          { name: "country", label: t("country"), required: true },
        ]}
        onSubmit={async (values) => {
          if (lines.length === 0) {
            toastError(t("addProductLine"));
            return;
          }
          try {
            await api("/orders", {
              method: "POST",
              body: {
                customerId: values.customerId,
                shippingAddress: {
                  label: values.label,
                  street: values.street,
                  city: values.city,
                  country: values.country,
                },
                items: lines.map((line) => {
                  const product = products.find((p) => p.id === line.productId);
                  return {
                    productId: line.productId,
                    name: product?.name ?? "product",
                    sku: product?.sku ?? "unknown",
                    quantity: Number(line.quantity),
                    unitPrice: Number(line.unitPrice),
                    taxRate: 0,
                  };
                }),
                idempotencyKey: `web-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
              },
            });
            toastSuccess(t("orderCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorCreateOrder"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createOrder")}
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel={t("addProduct")}
          columns={[
            { key: "productId", label: t("product"), type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: t("qty"), type: "number", required: true },
            { key: "unitPrice", label: t("unitPrice"), type: "number", required: true },
          ]}
        />
      </FormDialog>
      <FormDialog
        open={payFor !== null}
        title={t("capturePaymentTitle", { order: payFor?.orderNumber ?? "" })}
        subtitle={t("capturePaymentSubtitle")}
        fields={[
          { name: "amount", label: t("amount"), type: "number", defaultValue: 0 },
          { name: "method", label: t("method"), type: "select", options: [{ value: "card", label: t("methodCard") }, { value: "transfer", label: t("methodTransfer") }, { value: "cash", label: t("methodCash") }], defaultValue: "card" },
          { name: "reference", label: t("reference") },
        ]}
        onSubmit={async (values) => {
          if (!payFor) return;
          try {
            await api(`/orders/${payFor.id}/payments`, {
              method: "POST",
              body: {
                amount: Number(values.amount),
                method: String(values.method),
                reference: String(values.reference ?? ""),
                idempotencyKey: `web-${Date.now()}`,
              },
            });
            toastSuccess(t("paymentCaptured"));
            setPayFor(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorCapturePayment"));
          }
        }}
        onClose={() => setPayFor(null)}
        submitLabel={t("capture")}
      />
      <ReturnDialog
        key={returnFor?.id ?? "none"}
        open={returnFor !== null}
        order={returnFor}
        onClose={() => setReturnFor(null)}
        onSuccess={() => void refresh()}
      />
    </>
  );
}

function ReturnDialog({
  open,
  order,
  onClose,
  onSuccess,
}: {
  open: boolean;
  order: ReturnableOrder | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("sales");
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);

  useEffect(() => {
    if (open && order) {
      setLines(order.items.map((item) => ({ productId: item.productId, quantity: "", condition: "new" })));
    }
  }, [open, order]);

  const submit = async (values: Record<string, string | number>) => {
    if (!order) return;
    const reason = String(values.reason ?? "").trim();
    if (!reason) {
      toastError(t("returnReasonRequired"));
      return;
    }
    if (lines.length === 0) {
      toastError(t("returnNoLines"));
      return;
    }
    for (const line of lines) {
      const item = order.items.find((i) => i.productId === line.productId);
      const quantity = Number(line.quantity);
      if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
        toastError(t("returnInvalidQuantity"));
        return;
      }
    }
    try {
      await api("/rmas", {
        method: "POST",
        body: {
          orderId: order.id,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
            condition: String(line.condition ?? "new"),
          })),
          reason,
        },
      });
      toastSuccess(t("rmaCreated"));
      onClose();
      onSuccess();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorCreateRma"));
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("returnTitle", { order: order?.orderNumber ?? "" })}
      subtitle={t("returnSubtitle")}
      fields={[{ name: "reason", label: t("reason"), required: true }]}
      onSubmit={submit}
      onClose={onClose}
      submitLabel={t("return")}
    >
      <LineItemsEditor
        lines={lines}
        setLines={setLines}
        addLabel={t("addProduct")}
        columns={[
          { key: "productId", label: t("product"), type: "select", required: true, options: (order?.items ?? []).map((item) => ({ value: item.productId, label: `${item.sku} — ${item.name}` })) },
          { key: "quantity", label: t("qty"), type: "number", required: true },
          { key: "condition", label: t("condition"), type: "select", required: true, options: [
            { value: "new", label: t("conditionNew") },
            { value: "used", label: t("conditionUsed") },
            { value: "defective", label: t("conditionDefective") },
          ] },
        ]}
      />
    </FormDialog>
  );
}

function QuotesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Quote>("/quotes");
  const t = useTranslations("sales");

  const convert = async (quote: Quote) => {
    const ok = await confirmAction({ title: t("convertQuoteTitle", { quote: quote.quoteNumber }), text: t("convertQuoteText"), confirmText: t("convert") });
    if (!ok) return;
    try {
      await api(`/quotes/${quote.id}/convert`, { method: "POST" });
      toastSuccess(t("quoteConverted"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorConvertQuote"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("quote"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.quoteNumber}</Typography> },
        { label: t("customer"), render: (row) => `#${shortId(row.customerId)}` },
        { label: t("total"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.totals.total)}</Typography> },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("validUntil"), render: (row) => dateShort(row.validUntil) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("quotesEmptyTitle")}
      emptySubtitle={t("quotesEmptySubtitle")}
      rowActions={(row) =>
        row.status === "draft" ? (
          <Tooltip title={t("convertToOrder")}>
            <IconButton size="small" color="primary" aria-label={t("convertToOrder")} onClick={() => void convert(row)}>
              <ShoppingCartOutlinedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        ) : null
      }
    />
  );
}

function ShipmentsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Shipment>("/shipments");
  const t = useTranslations("sales");

  const advance = async (shipment: Shipment, status: string) => {
    const ok = await confirmAction({ title: t("markShipmentAs", { status }), text: t("markShipmentText"), confirmText: t("update") });
    if (!ok) return;
    try {
      await api(`/shipments/${shipment.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(t("shipmentNowStatus", { status }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateShipment"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("carrier"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.carrier}</Typography> },
        { label: t("tracking"), render: (row) => row.trackingNumber },
        { label: t("order"), render: (row) => `#${shortId(row.orderId)}` },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("shipmentsEmptyTitle")}
      emptySubtitle={t("shipmentsEmptySubtitle")}
      rowActions={(row) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {row.status === "draft" && (
            <Tooltip title={t("pack")}>
              <IconButton size="small" color="primary" aria-label={t("pack")} onClick={() => void advance(row, "packed")}>
                <LocalShippingOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
          {row.status === "packed" && (
            <Tooltip title={t("ship")}>
              <IconButton size="small" color="primary" aria-label={t("ship")} onClick={() => void advance(row, "shipped")}>
                <LocalShippingOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
          {row.status === "shipped" && (
            <Tooltip title={t("deliver")}>
              <IconButton size="small" color="success" aria-label={t("deliver")} onClick={() => void advance(row, "delivered")}>
                <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    />
  );
}

function RmasTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Rma>("/rmas");
  const t = useTranslations("sales");

  const setStatus = async (rma: Rma, status: string) => {
    const ok = await confirmAction({ title: t("setRmaStatus", { rma: rma.rmaNumber, status }), text: t("setRmaText"), confirmText: t("update") });
    if (!ok) return;
    try {
      await api(`/rmas/${rma.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(t("rmaNowStatus", { rma: rma.rmaNumber, status }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateRma"));
    }
  };

  const receive = async (rma: Rma) => {
    const ok = await confirmAction({ title: t("receiveTitle", { rma: rma.rmaNumber }), text: t("receiveText"), confirmText: t("receive") });
    if (!ok) return;
    try {
      await api(`/rmas/${rma.id}/status`, { method: "PATCH", body: { status: "received" } });
      toastSuccess(t("rmaReceived", { rma: rma.rmaNumber }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateRma"));
    }
  };

  const refund = async (rma: Rma) => {
    const ok = await confirmAction({ title: t("refundTitle", { rma: rma.rmaNumber }), text: t("refundText"), confirmText: t("refund") });
    if (!ok) return;
    try {
      await api(`/rmas/${rma.id}/status`, { method: "PATCH", body: { status: "refunded" } });
      toastSuccess(t("rmaRefunded", { rma: rma.rmaNumber }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateRma"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("rma"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.rmaNumber}</Typography> },
        { label: t("order"), render: (row) => `#${shortId(row.orderId)}` },
        { label: t("reason"), render: (row) => row.reason },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("rmasEmptyTitle")}
      emptySubtitle={t("rmasEmptySubtitle")}
      rowActions={(row) => {
        if (row.status === "requested") {
          return (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("approve")}>
                <IconButton size="small" color="success" aria-label={t("approve")} onClick={() => void setStatus(row, "approved")}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("reject")}>
                <IconButton size="small" color="error" aria-label={t("reject")} onClick={() => void setStatus(row, "rejected")}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        }
        if (row.status === "approved") {
          return (
            <Tooltip title={t("receive")}>
              <IconButton size="small" color="primary" aria-label={t("receive")} onClick={() => void receive(row)}>
                <MoveToInboxOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          );
        }
        if (row.status === "received") {
          return (
            <Tooltip title={t("refund")}>
              <IconButton size="small" color="error" aria-label={t("refund")} onClick={() => void refund(row)}>
                <CurrencyExchangeRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          );
        }
        return null;
      }}
    />
  );
}

function RecurringTab() {
  const { rows, total, page, setPage, loading } = useList<Recurring>("/recurring-invoices");
  const t = useTranslations("sales");

  return (
    <DataTable
      columns={[
        { label: t("customer"), render: (row) => `#${shortId(row.customerId)}` },
        { label: t("interval"), render: (row) => <Typography sx={{ textTransform: "capitalize", fontWeight: 600 }}>{row.interval}</Typography> },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("recurringEmptyTitle")}
      emptySubtitle={t("recurringEmptySubtitle")}
    />
  );
}

export default function SalesPage() {
  const [tab, setTab] = useState(0);
  const t = useTranslations("sales");

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader
          title={t("pageTitle")}
          subtitle={t("pageSubtitle")}
        />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label={t("tabOrders")} />
          <Tab label={t("tabCustomers")} />
          <Tab label={t("tabQuotes")} />
          <Tab label={t("tabShipments")} />
          <Tab label={t("tabReturns")} />
          <Tab label={t("tabRecurring")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <OrdersTab />}
      {tab === 1 && <CustomersTab />}
      {tab === 2 && <QuotesTab />}
      {tab === 3 && <ShipmentsTab />}
      {tab === 4 && <RmasTab />}
      {tab === 5 && <RecurringTab />}
    </AppShell>
  );
}