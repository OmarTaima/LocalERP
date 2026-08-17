"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "multiline" | "password" | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | number;
  fullWidth?: boolean;
  helper?: string;
  disabled?: boolean;
};

export type LineItemField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export function FormDialog({
  open,
  title,
  subtitle,
  fields,
  initialValues,
  onSubmit,
  onClose,
  submitLabel = "Save",
  loading,
  maxWidth,
  children,
  onFieldChange,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: FormField[];
  initialValues?: Record<string, string | number>;
  onSubmit: (values: Record<string, string | number>) => void | Promise<void>;
  onClose: () => void;
  submitLabel?: string;
  loading?: boolean;
  maxWidth?: "sm" | "md";
  children?: ReactNode;
  onFieldChange?: (values: Record<string, string | number>) => void;
}) {
  const [values, setValues] = useState<Record<string, string | number>>(() => {
    const seed: Record<string, string | number> = {};
    for (const field of fields) {
      seed[field.name] = initialValues?.[field.name] ?? field.defaultValue ?? (field.type === "number" ? "" : "");
    }
    return seed;
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Re-seeds select fields whose current value is no longer valid or empty so that
  // dynamically loaded options (e.g. roles for a selected company) can supply a default.
  const fieldsKey = fields
    .map((field) => `${field.name}:${field.defaultValue ?? ""}:${(field.options ?? []).map((option) => option.value).join(",")}`)
    .join("|");
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const field of fields) {
        if (field.type === "select" && field.options?.some((option) => option.value === String(prev[field.name]))) continue;
        if (field.type !== "select" && prev[field.name] !== "" && prev[field.name] !== undefined) continue;
        next[field.name] = field.defaultValue ?? "";
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [fieldsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [name]: event.target.value };
    setValues(next);
    onFieldChange?.(next);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth ?? "sm"}>
      <DialogTitle sx={{ fontWeight: 700, color: "#0f172a" }}>
        {title}
        {subtitle && (
          <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, mt: 0.5 }}>{subtitle}</Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {fields.map((field) => (
            <TextField
              key={field.name}
              label={`${field.label}${field.required ? " *" : ""}`}
              value={values[field.name]}
              onChange={set(field.name)}
              select={field.type === "select"}
              multiline={field.type === "multiline"}
              minRows={field.type === "multiline" ? 3 : undefined}
              type={
                field.type === "date"
                  ? "date"
                  : field.type === "number"
                    ? "number"
                    : field.type === "password"
                      ? showPassword ? "text" : "password"
                      : field.type === "email"
                        ? "email"
                        : field.type === "multiline" ? undefined : "text"
              }
              size="small"
              fullWidth
              helperText={field.helper}
              disabled={field.disabled}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: field.type === "number" ? 0 : undefined },
                ...(field.type === "password"
                  ? {
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton edge="end" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                              {showPassword ? <VisibilityOff sx={{ fontSize: 19 }} /> : <Visibility sx={{ fontSize: 19 }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }
                  : {}),
              }}
            >
              {field.type === "select" &&
                field.options?.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>
          ))}
        </Stack>
        {children && <Box sx={{ mt: 2.5 }}>{children}</Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: "#64748b" }}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting || loading}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function LineItemsEditor({
  lines,
  setLines,
  columns,
  addLabel = "Add line",
}: {
  lines: Record<string, string | number>[];
  setLines: (lines: Record<string, string | number>[]) => void;
  columns: LineItemField[];
  addLabel?: string;
}) {
  const update = (index: number, key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = lines.map((line, i) => (i === index ? { ...line, [key]: event.target.value } : line));
    setLines(next);
  };

  const remove = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const add = () => {
    const blank: Record<string, string | number> = {};
    for (const column of columns) blank[column.key] = "";
    setLines([...lines, blank]);
  };

  return (
    <Stack spacing={1.25} sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={1}>
        {columns.map((column) => (
          <Typography key={column.key} sx={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#94a3b8" }}>
            {column.label}
          </Typography>
        ))}
        <Box width={28} />
      </Stack>
      {lines.map((line, index) => (
        <Stack key={index} direction="row" spacing={1} alignItems="center">
          {columns.map((column) => (
            <TextField
              key={column.key}
              value={line[column.key]}
              onChange={update(index, column.key)}
              select={column.type === "select"}
              type={column.type === "number" ? "number" : "text"}
              size="small"
              sx={{ flex: 1 }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: column.type === "number" ? 0 : undefined } }}
            >
              {column.type === "select" &&
                column.options?.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>
          ))}
          <IconButton size="small" onClick={() => remove(index)} sx={{ color: "#dc2626" }}>
            <RemoveCircleOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={add} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
        {addLabel}
      </Button>
      <Divider sx={{ mt: 1.5 }} />
    </Stack>
  );
}