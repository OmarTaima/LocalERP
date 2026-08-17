"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { AppShell, itemVariants } from "@/components/app-shell";
import { StatusChip, EmptyState, toastError } from "@/components/ui";
import { api } from "@/lib/api";

type DashboardStats = {
  revenue: number;
  orders: number;
  aov: number;
  lowStockCount: number;
  expiringBatches: number;
  pendingApprovals: number;
  inventoryValue: number;
  chartSeries: { date: string; value: number }[];
};

type ApprovalItem = { id: string; entityType: string; entityId: string; requestedBy: string; createdAt: string };

type DashboardAlerts = {
  lowStock: { productId: string; sku: string; name: string; quantity: number; threshold: number }[];
  expiringBatches: { batchId: string; lotNumber: string; expiryDate: string | null; quantity: number }[];
  overdueInvoices: { orderId: string; orderNumber: string; customerName: string; total: number; paid: number; status: string }[];
};

type OrderRow = { id: string; orderNumber: string; customerName: string; totals: { total: number }; status: string; createdAt: string };

const fmt = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [statsData, approvalsData, alertsData, ordersData] = await Promise.all([
          api<DashboardStats>("/dashboard/stats"),
          api<{ items: ApprovalItem[] }>("/dashboard/approvals"),
          api<DashboardAlerts>("/dashboard/alerts"),
          api<{ items: OrderRow[] }>("/orders?page=1&pageSize=6"),
        ]);
        setStats(statsData);
        setApprovals(approvalsData.items);
        setAlerts(alertsData);
        setOrders(ordersData.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to load dashboard");
      }
    })();
  }, []);

  const kpis = [
    { label: "Revenue", value: stats ? fmt(stats.revenue) : null, delta: stats && stats.aov > 0 ? `AOV ${fmt(stats.aov)}` : null, color: "#4f46e5" },
    { label: "Orders", value: stats ? String(stats.orders) : null, delta: null, color: "#0ea5e9" },
    { label: "Inventory Value", value: stats ? fmt(stats.inventoryValue) : null, delta: null, color: "#059669" },
    { label: "Stock Alerts", value: stats ? String(stats.lowStockCount + stats.expiringBatches) : null, delta: null, color: "#d97706" },
  ];

  const chartMax = stats && stats.chartSeries.length > 0 ? Math.max(...stats.chartSeries.map((point) => point.value)) : 1;

  return (
    <AppShell
      
    >
      <motion.div variants={itemVariants}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "start", sm: "center" }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ color: "#0f172a" }}>Executive Overview</Typography>
            <Typography sx={{ color: "#64748b", mt: 0.5, fontSize: 14 }}>A quick look at how your business is doing today.</Typography>
            <Typography sx={{ color: "#94a3b8", mt: 0.25, fontSize: 12.5 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · Live data
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ mt: { xs: 2, sm: 0 } }}>
            <Button
              variant="outlined"
              onClick={() =>
                void toastError(
                  error ?? (stats
                    ? `Revenue ${fmt(stats.revenue)} · ${stats.orders} orders · ${fmt(stats.aov)} AOV`
                    : "Dashboard data is loading") + " — reports open in Accounting",
                )
              }
            >
              Run report
            </Button>
          </Stack>
        </Stack>
      </motion.div>

      {error && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #fecaca", bgcolor: "#fef2f2", mb: 3 }}>
          <Typography sx={{ color: "#dc2626", fontSize: 13.5, fontWeight: 600 }}>
            {error} — check that the backend is running on port 4000.
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2.5, mb: 3 }}>
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={itemVariants} whileHover={{ y: -4 }}>
            <Paper elevation={0} sx={{ p: 2.75, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
                  {kpi.label}
                </Typography>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${kpi.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: kpi.color }} />
                </Box>
              </Stack>
              {kpi.value === null ? (
                <Skeleton width="70%" height={38} sx={{ mt: 1 }} />
              ) : (
                <Typography sx={{ fontSize: 30, fontWeight: 700, color: "#0f172a", mt: 1, letterSpacing: "-0.02em" }}>
                  {kpi.value}
                </Typography>
              )}
              {kpi.delta && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
                  <TrendingUpIcon sx={{ fontSize: 16, color: "#059669" }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#059669" }}>{kpi.delta}</Typography>
                </Stack>
              )}
              {kpi.delta === null && kpi.value !== null && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
                  <TrendingDownIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
                  <Typography sx={{ fontSize: 12.5, color: "#94a3b8" }}>live from ERP</Typography>
                </Stack>
              )}
            </Paper>
          </motion.div>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2.5, mb: 3 }}>
        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ color: "#0f172a" }}>Revenue trend</Typography>
                <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>Paid orders · daily totals</Typography>
              </Box>
              <Chip label="Live" size="small" sx={{ bgcolor: "#eef2ff", color: "#4f46e5", fontWeight: 700 }} />
            </Stack>
            {!stats || stats.chartSeries.length === 0 ? (
              <EmptyState
                icon={<TrendingUpIcon />}
                title="No revenue yet"
                subtitle="Revenue appears once orders are paid — try the Sales module"
              />
            ) : (
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 190 }}>
                {stats.chartSeries.slice(-12).map((point, index) => (
                  <Box key={point.date} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, height: "100%" }}>
                    <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{fmt(point.value)}</Typography>
                    <Box sx={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.7, delay: 0.15 + index * 0.06, ease: "easeOut" }}
                        style={{ transformOrigin: "bottom", width: "100%", height: "100%" }}
                      >
                        <Box
                          sx={{
                            width: "100%",
                            height: `${Math.max((point.value / chartMax) * 100, 4)}%`,
                            borderRadius: "6px 6px 2px 2px",
                            background: "linear-gradient(180deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)",
                            transition: "filter 0.2s",
                            "&:hover": { filter: "brightness(1.15)" },
                          }}
                        />
                      </motion.div>
                    </Box>
                    <Typography sx={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>{shortDate(point.date)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ color: "#0f172a" }}>Alerts</Typography>
              <Chip
                label={alerts ? String(alerts.lowStock.length + alerts.overdueInvoices.length + alerts.expiringBatches.length) : "…"}
                size="small"
                sx={{ bgcolor: "#fef3c7", color: "#d97706", fontWeight: 700 }}
              />
            </Stack>
            {!alerts || (alerts.lowStock.length === 0 && alerts.overdueInvoices.length === 0 && alerts.expiringBatches.length === 0) ? (
              <EmptyState icon={<WarningAmberRoundedIcon />} title="All clear" subtitle="No low stock, expiring batches, or overdue invoices" />
            ) : (
              <Box sx={{ maxHeight: 260, overflowY: "auto" }}>
                {alerts.lowStock.slice(0, 3).map((item) => (
                  <Stack key={item.productId} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706", fontSize: 15, fontWeight: 700 }}>!</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }} noWrap>{item.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: "#94a3b8" }} noWrap>
                        {item.sku} · {item.quantity} left / threshold {item.threshold}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
                {alerts.overdueInvoices.slice(0, 3).map((invoice) => (
                  <Stack key={invoice.orderId} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontSize: 15, fontWeight: 700 }}>!</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }} noWrap>{invoice.orderNumber}</Typography>
                      <Typography sx={{ fontSize: 12, color: "#94a3b8" }} noWrap>
                        {invoice.customerName} · {fmt(invoice.total - invoice.paid)} outstanding
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>
        </motion.div>
      </Box>

      <motion.div variants={itemVariants}>
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#0f172a" }}>Recent orders</Typography>
            <Button variant="text" size="small" onClick={() => void toastError("Full list opens in Sales & Orders")}>View all</Button>
          </Stack>
          {orders.length === 0 ? (
            <EmptyState icon={<TrendingUpIcon />} title="No orders yet" subtitle="Orders created in Sales & Orders appear here" />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 560 }}>
                <Stack direction="row" sx={{ px: 1.5, py: 1, borderBottom: "1px solid #e2e8f0" }}>
                  {["Order", "Customer", "Total", "Status"].map((head) => (
                    <Typography key={head} sx={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>
                      {head}
                    </Typography>
                  ))}
                </Stack>
                {orders.map((order) => (
                  <Stack key={order.id} direction="row" alignItems="center" sx={{ px: 1.5, py: 1.5, borderBottom: "1px solid #f1f5f9", "&:hover": { bgcolor: "#f8fafc" } }}>
                    <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#4f46e5" }}>{order.orderNumber}</Typography>
                    <Typography sx={{ flex: 1, fontSize: 13.5, color: "#334155" }}>{order.customerName}</Typography>
                    <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>{fmt(order.totals.total)}</Typography>
                    <Box sx={{ flex: 1 }}><StatusChip status={order.status} /></Box>
                  </Stack>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      </motion.div>

      {approvals.length > 0 && (
        <motion.div variants={itemVariants}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3, mt: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ color: "#0f172a" }}>Pending approvals</Typography>
              <Chip label={approvals.length} size="small" sx={{ bgcolor: "#eef2ff", color: "#4f46e5", fontWeight: 700 }} />
            </Stack>
            {approvals.slice(0, 4).map((approval) => (
              <Stack key={approval.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", fontSize: 15, fontWeight: 700 }}>!</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }} noWrap>{approval.entityType} · {approval.entityId.slice(-6)}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#94a3b8" }} noWrap>requested {shortDate(approval.createdAt)}</Typography>
                </Box>
              </Stack>
            ))}
          </Paper>
        </motion.div>
      )}
    </AppShell>
  );
}