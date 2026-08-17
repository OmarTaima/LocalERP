"use client";

import type { ReactNode } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { EmptyState } from "./ui";

export type Column<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  minWidth?: number;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  total,
  page,
  onPageChange,
  loading,
  emptyTitle,
  emptySubtitle,
  emptyIcon,
  actions,
  rowActions,
}: {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
  emptyIcon?: ReactNode;
  actions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
}) {
  const pageSize = 20;

  if (!loading && rows.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3 }}>
        {actions && <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>{actions}</Stack>}
        <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3, overflow: "hidden" }}>
      {actions && (
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 1.5, borderBottom: "1px solid #f1f5f9" }}>
          {actions}
        </Stack>
      )}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 10 }}>
          <CircularProgress size={34} sx={{ color: "#4f46e5" }} />
          <Typography sx={{ color: "#94a3b8", fontSize: 13, mt: 1.5 }}>Loading…</Typography>
        </Stack>
      ) : (
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.label}
                    align={column.align ?? "left"}
                    sx={{
                      bgcolor: "#f8fafc",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#64748b",
                      minWidth: column.minWidth,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {column.label}
                  </TableCell>
                ))}
                {rowActions && <TableCell align="right" sx={{ bgcolor: "#f8fafc", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ "&:last-child td": { borderBottom: "none" } }}>
                  {columns.map((column) => (
                    <TableCell key={column.label} align={column.align ?? "left"} sx={{ fontSize: 13, color: "#334155", whiteSpace: "nowrap" }}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {rowActions && <TableCell align="right">{rowActions(row)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!loading && total > pageSize && (
        <TablePagination
          component="div"
          count={total}
          page={page - 1}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
          onPageChange={(_, nextPage) => onPageChange(nextPage + 1)}
          sx={{ borderTop: "1px solid #f1f5f9" }}
        />
      )}
    </Paper>
  );
}