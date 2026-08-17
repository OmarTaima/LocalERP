"use client";

import type { ReactNode } from "react";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

export const SWAL_THEME = {
  confirmButtonColor: "#4f46e5",
  cancelButtonColor: "#64748b",
  background: "#ffffff",
  color: "#0f172a",
};

let uiLocale: "en" | "ar" = "en";

export function setUiLocale(locale: "en" | "ar"): void {
  uiLocale = locale;
}

const toastPosition = (): "bottom-start" | "bottom-end" => (uiLocale === "ar" ? "bottom-start" : "bottom-end");

export function toastSuccess(title: string): void {
  void Swal.mixin({
    toast: true,
    position: toastPosition(),
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
    background: "#0f172a",
    color: "#e2e8f0",
  }).fire({ icon: "success", title });
}

export function toastError(title: string): void {
  void Swal.mixin({
    toast: true,
    position: toastPosition(),
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true,
    background: "#0f172a",
    color: "#e2e8f0",
  }).fire({ icon: "error", title });
}

export async function confirmAction(options: { title: string; text: string; confirmText?: string; cancelText?: string; icon?: "warning" | "question" }): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? (uiLocale === "ar" ? "تأكيد" : "Confirm"),
    cancelButtonText: options.cancelText ?? (uiLocale === "ar" ? "إلغاء" : "Cancel"),
    ...SWAL_THEME,
  });
  return result.isConfirmed;
}

const STATUS_TONES: Record<string, { bg: string; color: string }> = {
  active: { bg: "#ecfdf5", color: "#059669" },
  paid: { bg: "#ecfdf5", color: "#059669" },
  delivered: { bg: "#ecfdf5", color: "#059669" },
  completed: { bg: "#ecfdf5", color: "#059669" },
  approved: { bg: "#ecfdf5", color: "#059669" },
  received: { bg: "#ecfdf5", color: "#059669" },
  sent: { bg: "#e0f2fe", color: "#0284c7" },
  confirmed: { bg: "#e0f2fe", color: "#0284c7" },
  shipped: { bg: "#e0f2fe", color: "#0284c7" },
  submitted: { bg: "#e0f2fe", color: "#0284c7" },
  pending: { bg: "#fef3c7", color: "#d97706" },
  "pending-approval": { bg: "#fef3c7", color: "#d97706" },
  draft: { bg: "#f1f5f9", color: "#475569" },
  "in-progress": { bg: "#ede9fe", color: "#7c3aed" },
  rejected: { bg: "#fee2e2", color: "#dc2626" },
  cancelled: { bg: "#fee2e2", color: "#dc2626" },
  refunded: { bg: "#fee2e2", color: "#dc2626" },
  terminated: { bg: "#fee2e2", color: "#dc2626" },
};

export function StatusChip({ status }: { status: string }) {
  const t = useTranslations("common");
  const tone = STATUS_TONES[status] ?? { bg: "#f1f5f9", color: "#475569" };
  const label = t.has(`status.${status}`) ? t(`status.${status}`) : status.replace(/-/g, " ");
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700, fontSize: 11.5, textTransform: "capitalize" }}
    />
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "start", sm: "center" }} sx={{ mb: 3, gap: 2 }}>
      <Box>
        <Typography variant="h4" sx={{ color: "#0f172a" }}>{title}</Typography>
        {subtitle && <Typography sx={{ color: "#64748b", mt: 0.5, fontSize: 14 }}>{subtitle}</Typography>}
      </Box>
      {actions && <Stack direction="row" spacing={1.5}>{actions}</Stack>}
    </Stack>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <Box sx={{ py: 8, textAlign: "center" }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{title}</Typography>
      {subtitle && <Typography sx={{ color: "#94a3b8", fontSize: 13, mt: 0.5 }}>{subtitle}</Typography>}
    </Box>
  );
}

export function PrimaryButton({ children, onClick, disabled, startIcon }: { children: ReactNode; onClick?: () => void; disabled?: boolean; startIcon?: ReactNode }) {
  return (
    <Button variant="contained" onClick={onClick} disabled={disabled} startIcon={startIcon}>
      {children}
    </Button>
  );
}

export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export function AnimateIn({ children, variants = itemVariants }: { children: ReactNode; variants?: typeof itemVariants }) {
  return <motion.div variants={variants}>{children}</motion.div>;
}