"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type Customer = { id: string; name: string; email: string; phone: string; creditLimit: number; totalSpent: number; status: string; createdAt: string };
type Order = { id: string; orderNumber: string; customerId: string; totals: { total: number }; status: string; createdAt: string };
type Quote = { id: string; quoteNumber: string; customerId: string; totals: { total: number }; status: string; validUntil: string };
type Shipment = { id: string; orderId: string; carrier: string; trackingNumber: string; status: string; createdAt: string };
type Rma = { id: string; rmaNumber: string; orderId: string; reason: string; status: string; createdAt: string };
type Recurring = { id: string; customerId: string; interval: string; status: string; createdAt: string };

const shortId = (id: string): string => id.slice(-6);

function CustomersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Customer>("/customers");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Email", render: (row) => row.email },
          { label: "Phone", render: (row) => row.phone || "—" },
          { label: "Credit Limit", render: (row) => currency(row.creditLimit) },
          { label: "Total Spent", render: (row) => currency(row.totalSpent) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
          { label: "Created", render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No customers yet"
        emptySubtitle="Create your first customer to start selling"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New customer</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New customer"
        subtitle="Customers can be invoiced and tracked with credit limits"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Email", required: true },
          { name: "phone", label: "Phone" },
          { name: "creditLimit", label: "Credit limit", type: "number", defaultValue: 0 },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/customers", { method: "POST", body: { name: values.name, email: values.email, phone: String(values.phone ?? ""), creditLimit: Number(values.creditLimit ?? 0) } });
            toastSuccess("Customer created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create customer");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create customer"
      />
    </>
  );
}

function OrdersTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Order>("/orders");
  const [payFor, setPayFor] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, string | number>[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);

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
      toastError(err instanceof Error ? err.message : "failed to load reference data");
    }
  };

  const advance = async (order: Order, status: string) => {
    const ok = await confirmAction({ title: `Mark ${order.orderNumber} as ${status}?`, text: "The order status will be updated and an audit entry recorded.", confirmText: "Update status" });
    if (!ok) return;
    try {
      await api(`/orders/${order.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(`${order.orderNumber} is now ${status}`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update status");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Order", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.orderNumber}</Typography> },
          { label: "Customer", render: (row) => `#${shortId(row.customerId)}` },
          { label: "Total", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.totals.total)}</Typography> },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
          { label: "Created", render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No orders yet"
        emptySubtitle="Create your first order to start selling"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New order</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {row.status === "draft" && (
              <Button size="small" variant="outlined" onClick={() => void advance(row, "confirmed")}>Confirm</Button>
            )}
            {row.status === "confirmed" && (
              <Button size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => setPayFor(row)}>Capture payment</Button>
            )}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title="New order"
        subtitle="Orders start as drafts and are confirmed by the team"
        fields={[
          { name: "customerId", label: "Customer", type: "select", required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
          { name: "label", label: "Address label", required: true, defaultValue: "Main" },
          { name: "street", label: "Street", required: true },
          { name: "city", label: "City", required: true },
          { name: "country", label: "Country", required: true },
        ]}
        onSubmit={async (values) => {
          if (lines.length === 0) {
            toastError("Add at least one product line");
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
            toastSuccess("Order created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create order");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create order"
      >
        <LineItemsEditor
          lines={lines}
          setLines={setLines}
          addLabel="Add product"
          columns={[
            { key: "productId", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })), required: true },
            { key: "quantity", label: "Qty", type: "number", required: true },
            { key: "unitPrice", label: "Unit price", type: "number", required: true },
          ]}
        />
      </FormDialog>
      <FormDialog
        open={payFor !== null}
        title={`Capture payment — ${payFor?.orderNumber ?? ""}`}
        subtitle="The order is marked paid when fully settled"
        fields={[
          { name: "amount", label: "Amount", type: "number", defaultValue: 0 },
          { name: "method", label: "Method", type: "select", options: [{ value: "card", label: "Card" }, { value: "transfer", label: "Bank transfer" }, { value: "cash", label: "Cash" }], defaultValue: "card" },
          { name: "reference", label: "Reference" },
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
            toastSuccess("Payment captured");
            setPayFor(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to capture payment");
          }
        }}
        onClose={() => setPayFor(null)}
        submitLabel="Capture"
      />
    </>
  );
}

function QuotesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Quote>("/quotes");

  const convert = async (quote: Quote) => {
    const ok = await confirmAction({ title: `Convert ${quote.quoteNumber} to an order?`, text: "An order will be created from the quote lines.", confirmText: "Convert" });
    if (!ok) return;
    try {
      await api(`/quotes/${quote.id}/convert`, { method: "POST" });
      toastSuccess("Quote converted to order");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to convert quote");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "Quote", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.quoteNumber}</Typography> },
        { label: "Customer", render: (row) => `#${shortId(row.customerId)}` },
        { label: "Total", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.totals.total)}</Typography> },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Valid until", render: (row) => dateShort(row.validUntil) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No quotes yet"
      emptySubtitle="Quotes sent to customers will appear here"
      rowActions={(row) =>
        row.status === "draft" ? (
          <Button size="small" variant="outlined" onClick={() => void convert(row)}>Convert to order</Button>
        ) : null
      }
    />
  );
}

function ShipmentsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Shipment>("/shipments");

  const advance = async (shipment: Shipment, status: string) => {
    const ok = await confirmAction({ title: `Mark shipment ${status}?`, text: "Stock is deducted when a shipment ships.", confirmText: "Update" });
    if (!ok) return;
    try {
      await api(`/shipments/${shipment.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(`Shipment is now ${status}`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update shipment");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "Carrier", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.carrier}</Typography> },
        { label: "Tracking", render: (row) => row.trackingNumber },
        { label: "Order", render: (row) => `#${shortId(row.orderId)}` },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No shipments yet"
      emptySubtitle="Create a shipment from a paid or fulfilled order"
      rowActions={(row) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {row.status === "draft" && <Button size="small" variant="outlined" onClick={() => void advance(row, "packed")}>Pack</Button>}
          {row.status === "packed" && <Button size="small" variant="outlined" onClick={() => void advance(row, "shipped")}>Ship</Button>}
          {row.status === "shipped" && <Button size="small" variant="outlined" onClick={() => void advance(row, "delivered")}>Deliver</Button>}
        </Stack>
      )}
    />
  );
}

function RmasTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Rma>("/rmas");

  const setStatus = async (rma: Rma, status: string) => {
    const ok = await confirmAction({ title: `Set ${rma.rmaNumber} to ${status}?`, text: "Approved returns are restocked when received.", confirmText: "Update" });
    if (!ok) return;
    try {
      await api(`/rmas/${rma.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(`${rma.rmaNumber} is ${status}`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update RMA");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "RMA", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.rmaNumber}</Typography> },
        { label: "Order", render: (row) => `#${shortId(row.orderId)}` },
        { label: "Reason", render: (row) => row.reason },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No returns yet"
      emptySubtitle="Return requests from shipped orders appear here"
      rowActions={(row) =>
        row.status === "requested" ? (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="outlined" onClick={() => void setStatus(row, "approved")}>Approve</Button>
            <Button size="small" variant="outlined" color="error" onClick={() => void setStatus(row, "rejected")}>Reject</Button>
          </Stack>
        ) : null
      }
    />
  );
}

function RecurringTab() {
  const { rows, total, page, setPage, loading } = useList<Recurring>("/recurring-invoices");

  return (
    <DataTable
      columns={[
        { label: "Customer", render: (row) => `#${shortId(row.customerId)}` },
        { label: "Interval", render: (row) => <Typography sx={{ textTransform: "capitalize", fontWeight: 600 }}>{row.interval}</Typography> },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No recurring invoices"
      emptySubtitle="Recurring billing plans appear here"
    />
  );
}

export default function SalesPage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Sales & Orders"
          subtitle="Sell to customers, manage orders, and track payments and returns."
        />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Orders" />
          <Tab label="Customers" />
          <Tab label="Quotes" />
          <Tab label="Shipments" />
          <Tab label="Returns" />
          <Tab label="Recurring" />
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