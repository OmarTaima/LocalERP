"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslations } from "next-intl";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { FormDialog, LineItemsEditor } from "@/components/form-dialog";
import { currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type DetailCustomer = { id: string; name: string; email: string; phone: string };

type OrderItem = { productId: string; name: string; sku: string; quantity: number; unitPrice: number; taxRate: number };
type ReturnableOrder = { id: string; orderNumber: string; items: OrderItem[] };

type DetailOrder = ReturnableOrder & {
  customerId: string;
  totals: { subtotal?: number; tax?: number; shipping?: number; total: number };
  status: string;
  shippingAddress: { label: string; street: string; city: string; country: string };
  version: number;
  createdAt: string;
  timeline: {
    payments: { amount: number; method: string; status: string; reference: string; paidAt: string }[];
    shipments: { carrier: string; trackingNumber: string; status: string; shippedAt: string; deliveredAt: string }[];
    rmas: { rmaNumber: string; status: string }[];
  };
};

const headCellSx = { bgcolor: "#f8fafc", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" };
const bodyCellSx = { fontSize: 13, color: "#334155", whiteSpace: "nowrap" };

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
      <Typography variant="h6" sx={{ color: "#0f172a", mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <Typography sx={{ fontSize: 13.5, color: "#334155" }}>
      {label}: <Box component="span" sx={{ fontWeight: 600 }}>{value}</Box>
    </Typography>
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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations("sales");
  const [order, setOrder] = useState<DetailOrder | null>(null);
  const [customer, setCustomer] = useState<DetailCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const [returnOpen, setReturnOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const data = await api<DetailOrder>(`/orders/${id}`);
        if (cancelled) return;
        setOrder(data);
        void api<DetailCustomer>(`/customers/${data.customerId}`)
          .then((customerData) => { if (!cancelled) setCustomer(customerData); })
          .catch(() => { if (!cancelled) setCustomer(null); });
      } catch (err) {
        if (!cancelled) {
          setError(true);
          toastError(err instanceof Error ? err.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, tick, t]);

  const advance = async (status: string) => {
    if (!order) return;
    const ok = await confirmAction({ title: t("markOrderAs", { order: order.orderNumber, status }), text: t("markOrderText"), confirmText: t("updateStatus") });
    if (!ok) return;
    try {
      await api(`/orders/${order.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(t("orderNowStatus", { order: order.orderNumber, status }));
      setOrder({ ...order, status });
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateStatus"));
    }
  };

  const methodLabel = (method: string): string =>
    method === "card" ? t("methodCard") : method === "transfer" ? t("methodTransfer") : method === "cash" ? t("methodCash") : method;

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <Link
          href="/sales"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4f46e5", fontWeight: 600, fontSize: 13.5, textDecoration: "none", marginBottom: 12 }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          {t("backToSales")}
        </Link>
        <PageHeader
          title={order?.orderNumber ?? `#${id.slice(-6)}`}
          subtitle={order ? t("detailSubtitle", { date: dateShort(order.createdAt), version: order.version }) : undefined}
          actions={
            order && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <StatusChip status={order.status} />
                {order.status === "draft" && (
                  <Button size="small" variant="outlined" onClick={() => void advance("confirmed")}>{t("confirm")}</Button>
                )}
                {(order.status === "shipped" || order.status === "delivered") && (
                  <Button size="small" variant="outlined" color="warning" onClick={() => setReturnOpen(true)}>{t("return")}</Button>
                )}
              </Stack>
            )
          }
        />
      </motion.div>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 12 }}>
          <CircularProgress size={34} sx={{ color: "#4f46e5" }} />
          <Typography sx={{ color: "#94a3b8", fontSize: 13, mt: 1.5 }}>{t("loadingOrder")}</Typography>
        </Stack>
      ) : error || !order ? (
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3, textAlign: "center", py: 10 }}>
          <Typography sx={{ color: "#64748b", fontSize: 14, mb: 2 }}>{t("loadError")}</Typography>
          <Button variant="contained" onClick={() => setTick((value) => value + 1)}>{t("retry")}</Button>
        </Paper>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mb: 3 }}>
            <motion.div variants={itemVariants}>
              <SectionCard title={t("customer")}>
                <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{customer?.name ?? `#${order.customerId.slice(-6)}`}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>{customer?.email ?? "—"}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.25 }}>{customer?.phone ?? "—"}</Typography>
              </SectionCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <SectionCard title={t("shippingAddress")}>
                <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{order.shippingAddress.label}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>
                  {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.country}
                </Typography>
              </SectionCard>
            </motion.div>
          </Box>

          <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
            <SectionCard title={t("items")}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {[t("sku"), t("name"), t("qty"), t("unitPrice"), t("taxRate"), t("lineTotal")].map((label) => (
                        <TableCell key={label} sx={headCellSx}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.productId} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                        <TableCell sx={bodyCellSx}>{item.sku}</TableCell>
                        <TableCell sx={bodyCellSx}><Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{item.name}</Typography></TableCell>
                        <TableCell sx={bodyCellSx}>{item.quantity}</TableCell>
                        <TableCell sx={bodyCellSx}>{currency(item.unitPrice)}</TableCell>
                        <TableCell sx={bodyCellSx}>{item.taxRate}%</TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Typography sx={{ fontWeight: 600 }}>{currency(item.quantity * item.unitPrice * (1 + item.taxRate / 100))}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack alignItems="flex-end" spacing={0.5} sx={{ mt: 2 }}>
                {order.totals.subtotal !== undefined && <TotalsRow label={t("totalsSubtotal")} value={currency(order.totals.subtotal)} />}
                {order.totals.tax !== undefined && <TotalsRow label={t("totalsTax")} value={currency(order.totals.tax)} />}
                {order.totals.shipping !== undefined && <TotalsRow label={t("totalsShipping")} value={currency(order.totals.shipping)} />}
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  {t("totalsTotal")}: {currency(order.totals.total)}
                </Typography>
              </Stack>
            </SectionCard>
          </motion.div>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mb: 3, alignItems: "start" }}>
            <motion.div variants={itemVariants}>
              <SectionCard title={t("payments")}>
                {order.timeline.payments.length === 0 ? (
                  <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>{t("noPayments")}</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {[t("amount"), t("method"), t("status"), t("reference"), t("paidAt")].map((label) => (
                            <TableCell key={label} sx={headCellSx}>{label}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {order.timeline.payments.map((payment) => (
                          <TableRow key={`${payment.paidAt}-${payment.reference}-${payment.amount}`} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                            <TableCell sx={bodyCellSx}><Typography sx={{ fontWeight: 600 }}>{currency(payment.amount)}</Typography></TableCell>
                            <TableCell sx={bodyCellSx}><Typography sx={{ textTransform: "capitalize" }}>{methodLabel(payment.method)}</Typography></TableCell>
                            <TableCell sx={bodyCellSx}><StatusChip status={payment.status} /></TableCell>
                            <TableCell sx={bodyCellSx}>{payment.reference || "—"}</TableCell>
                            <TableCell sx={bodyCellSx}>{dateShort(payment.paidAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </SectionCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <SectionCard title={t("shipments")}>
                {order.timeline.shipments.length === 0 ? (
                  <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>{t("noShipments")}</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {[t("carrier"), t("tracking"), t("status"), t("shippedAt"), t("deliveredAt")].map((label) => (
                            <TableCell key={label} sx={headCellSx}>{label}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {order.timeline.shipments.map((shipment) => (
                          <TableRow key={`${shipment.trackingNumber}-${shipment.shippedAt}`} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                            <TableCell sx={bodyCellSx}><Typography sx={{ fontWeight: 600 }}>{shipment.carrier}</Typography></TableCell>
                            <TableCell sx={bodyCellSx}>{shipment.trackingNumber}</TableCell>
                            <TableCell sx={bodyCellSx}><StatusChip status={shipment.status} /></TableCell>
                            <TableCell sx={bodyCellSx}>{dateShort(shipment.shippedAt)}</TableCell>
                            <TableCell sx={bodyCellSx}>{dateShort(shipment.deliveredAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </SectionCard>
            </motion.div>
          </Box>

          <motion.div variants={itemVariants}>
            <SectionCard title={t("returns")}>
              {order.timeline.rmas.length === 0 ? (
                <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>{t("rmasEmptyTitle")}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {[t("rma"), t("status")].map((label) => (
                          <TableCell key={label} sx={headCellSx}>{label}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.timeline.rmas.map((rma) => (
                        <TableRow key={rma.rmaNumber} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                          <TableCell sx={bodyCellSx}><Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{rma.rmaNumber}</Typography></TableCell>
                          <TableCell sx={bodyCellSx}><StatusChip status={rma.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </SectionCard>
          </motion.div>
        </>
      )}

      <ReturnDialog
        key={order?.id ?? "none"}
        open={returnOpen}
        order={order}
        onClose={() => setReturnOpen(false)}
        onSuccess={() => setTick((value) => value + 1)}
      />
    </AppShell>
  );
}