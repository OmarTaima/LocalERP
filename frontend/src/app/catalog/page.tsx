"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TuneIcon from "@mui/icons-material/Tune";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { AvatarUpload } from "@/components/avatar-upload";
import { useList, useSimpleList, currency, dateShort } from "@/lib/use-list";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Product = { id: string; sku: string; name: string; brand: string; categoryId: string | null; price: number; cost: number; stock: number; lowStockThreshold: number; images: string[]; isActive: boolean; createdAt: string };
type Category = { id: string; name: string; slug: string; parentId: string | null; order: number };
type TaxRule = { id: string; name: string; rate: number; appliesTo: string; region: string | null; isActive: boolean };
type PriceList = { id: string; name: string; isDefault: boolean; items: number };
type ReorderRule = { id: string; productId: string; warehouseId: string; minQuantity: number; maxQuantity: number; enabled: boolean };
type Warehouse = { id: string; name: string; isDefault: boolean; isActive: boolean };

function ProductsTab() {
  const t = useTranslations("catalog");
  const { rows, total, page, setPage, loading, refresh } = useList<Product>("/products");
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const canEditProduct = user?.kind === "company" && user.permissions.includes("catalog:write");

  const openCreate = async () => {
    try {
      const categoryRows = await api<Category[]>("/categories");
      setCategories(categoryRows);
      setProductImage(null);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errLoadCategories"));
    }
  };

  const openEdit = async (product: Product) => {
    try {
      const categoryRows = await api<Category[]>("/categories");
      setCategories(categoryRows);
      setEditImage(null);
      setEditingProduct(product);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errLoadCategories"));
    }
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setEditImage(null);
  };

  const openAdjust = async (product: Product) => {
    try {
      const warehouseRows = await api<Warehouse[]>("/warehouses");
      setWarehouses(warehouseRows);
      setAdjustFor(product);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errLoadWarehouses"));
    }
  };

  const deactivate = async (product: Product) => {
    const ok = await confirmAction({ title: t("deactivateTitle", { sku: product.sku }), text: t("deactivateText"), confirmText: t("deactivate") });
    if (!ok) return;
    try {
      await api(`/products/${product.id}`, { method: "PATCH", body: { isActive: false } });
      toastSuccess(t("toastProductDeactivated"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errDeactivateProduct"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          {
            label: t("photo"),
            render: (row) =>
              row.images?.[0] ? (
                <Box component="img" src={assetUrl(row.images[0])} alt={row.name} sx={{ width: 40, height: 40, borderRadius: 2, objectFit: "cover" }} />
              ) : (
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Inventory2OutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
              ),
          },
          { label: t("sku"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.sku}</Typography> },
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("brand"), render: (row) => row.brand || "—" },
          { label: t("price"), render: (row) => currency(row.price) },
          { label: t("cost"), render: (row) => currency(row.cost) },
          {
            label: t("stock"),
            render: (row) => {
              const isOut = row.stock <= 0;
              const isLow = row.stock <= row.lowStockThreshold;
              const color = isOut ? "#dc2626" : isLow ? "#d97706" : "#334155";
              return (
                <Typography sx={{ fontSize: 13, fontWeight: isLow ? 700 : 400, color }}>
                  {row.stock}
                  {isLow && (
                    <Typography component="span" sx={{ marginInlineStart: 1, fontSize: 11, fontWeight: 600, color, opacity: 0.85 }}>
                      {t("lowStock")}
                    </Typography>
                  )}
                </Typography>
              );
            },
          },
          { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
          { label: t("created"), render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("emptyProductsTitle")}
        emptySubtitle={t("emptyProductsSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newProduct")}</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {canEditProduct && (
              <Tooltip title={t("editProductTitle", { name: row.name })}>
                <IconButton size="small" color="primary" aria-label={t("editProductTitle", { name: row.name })} onClick={() => void openEdit(row)}>
                  <EditOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t("adjustStock")}>
              <IconButton size="small" color="primary" aria-label={t("adjustStock")} onClick={() => void openAdjust(row)}>
                <TuneIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            {row.isActive && (
              <Tooltip title={t("deactivate")}>
                <IconButton size="small" color="error" aria-label={t("deactivate")} onClick={() => void deactivate(row)}>
                  <BlockIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title={t("newProduct")}
        fields={[
          { name: "sku", label: t("sku"), required: true },
          { name: "name", label: t("name"), required: true },
          { name: "categoryId", label: t("category"), type: "select", options: [{ value: "", label: t("none") }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
          { name: "brand", label: t("brand") },
          { name: "price", label: t("sellingPrice"), type: "number", required: true },
          { name: "cost", label: t("cost"), type: "number", required: true },
          { name: "lowStockThreshold", label: t("lowStockThreshold"), type: "number", defaultValue: 5 },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/products", {
              method: "POST",
              body: {
                sku: values.sku,
                name: values.name,
                brand: String(values.brand ?? ""),
                price: Number(values.price),
                cost: Number(values.cost),
                lowStockThreshold: Number(values.lowStockThreshold ?? 5),
                ...(values.categoryId ? { categoryId: values.categoryId } : {}),
                ...(productImage ? { image: productImage } : {}),
              },
            });
            toastSuccess(t("toastProductCreated"));
            setCreateOpen(false);
            setProductImage(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateProduct"));
          }
        }}
        onClose={() => { setCreateOpen(false); setProductImage(null); }}
        submitLabel={t("createProduct")}
      >
        <AvatarUpload
          value={productImage}
          onChange={setProductImage}
          size={72}
          shape="square"
          folder="products"
          placeholderIcon={<Inventory2OutlinedIcon sx={{ fontSize: 34 }} />}
        />
      </FormDialog>
      <FormDialog
        key={editingProduct ? `edit-${editingProduct.id}` : "new-product"}
        open={editingProduct !== null}
        title={editingProduct ? t("editProductTitle", { name: editingProduct.name }) : t("editProduct")}
        subtitle={t("editProductSubtitle")}
        fields={[
          { name: "sku", label: t("sku"), required: true, defaultValue: editingProduct?.sku },
          { name: "name", label: t("name"), required: true, defaultValue: editingProduct?.name },
          { name: "categoryId", label: t("category"), type: "select", options: [{ value: "", label: t("none") }, ...categories.map((c) => ({ value: c.id, label: c.name }))], defaultValue: editingProduct?.categoryId ?? "" },
          { name: "brand", label: t("brand"), defaultValue: editingProduct?.brand },
          { name: "price", label: t("sellingPrice"), type: "number", required: true, defaultValue: editingProduct?.price },
          { name: "cost", label: t("cost"), type: "number", required: true, defaultValue: editingProduct?.cost },
          { name: "lowStockThreshold", label: t("lowStockThreshold"), type: "number", defaultValue: editingProduct?.lowStockThreshold },
        ]}
        onSubmit={async (values) => {
          if (!editingProduct) return;
          try {
            await api(`/products/${editingProduct.id}`, {
              method: "PATCH",
              body: {
                sku: values.sku,
                name: values.name,
                brand: String(values.brand ?? ""),
                price: Number(values.price),
                cost: Number(values.cost),
                lowStockThreshold: Number(values.lowStockThreshold ?? editingProduct.lowStockThreshold),
                ...(values.categoryId ? { categoryId: values.categoryId } : {}),
                ...(editImage ? { image: editImage } : {}),
              },
            });
            toastSuccess(t("toastProductUpdated"));
            closeEdit();
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errUpdateProduct"));
          }
        }}
        onClose={closeEdit}
        submitLabel={t("saveChanges")}
      >
        <AvatarUpload
          value={editImage ?? (assetUrl(editingProduct?.images[0]) ?? null)}
          onChange={setEditImage}
          size={72}
          shape="square"
          folder="products"
          placeholderIcon={<Inventory2OutlinedIcon sx={{ fontSize: 34 }} />}
        />
      </FormDialog>
      <FormDialog
        open={adjustFor !== null}
        title={t("adjustStockTitle", { sku: adjustFor?.sku ?? "" })}
        subtitle={t("adjustStockSubtitle")}
        fields={[
          { name: "warehouseId", label: t("warehouse"), type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "quantity", label: t("quantityNonZero"), type: "number", required: true },
          { name: "note", label: t("note") },
        ]}
        onSubmit={async (values) => {
          if (!adjustFor) return;
          try {
            await api(`/products/${adjustFor.id}/stock-adjust`, {
              method: "POST",
              body: {
                warehouseId: values.warehouseId,
                quantity: Number(values.quantity),
                note: String(values.note ?? ""),
              },
            });
            toastSuccess(t("toastStockAdjusted"));
            setAdjustFor(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errAdjustStock"));
          }
        }}
        onClose={() => setAdjustFor(null)}
        submitLabel={t("adjust")}
      />
    </>
  );
}

function CategoriesTab() {
  const t = useTranslations("catalog");
  const { rows, loading, refresh } = useSimpleList<Category>("/categories");
  const [createOpen, setCreateOpen] = useState(false);

  const remove = async (category: Category) => {
    const ok = await confirmAction({ title: t("deleteCategoryTitle", { name: category.name }), text: t("deleteCategoryText"), confirmText: t("delete") });
    if (!ok) return;
    try {
      await api(`/categories/${category.id}`, { method: "DELETE" });
      toastSuccess(t("toastCategoryDeleted"));
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errDeleteCategory"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("slug"), render: (row) => row.slug },
          { label: t("parent"), render: (row) => (row.parentId ? `#${row.parentId.slice(-6)}` : "—") },
          { label: t("order"), render: (row) => row.order },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("emptyCategoriesTitle")}
        emptySubtitle={t("emptyCategoriesSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newCategory")}</Button>
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
        title={t("newCategory")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "slug", label: t("slugField") },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/categories", { method: "POST", body: { name: values.name, ...(values.slug ? { slug: values.slug } : {}) } });
            toastSuccess(t("toastCategoryCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateCategory"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createCategory")}
      />
    </>
  );
}

function TaxRulesTab() {
  const t = useTranslations("catalog");
  const { rows, loading, refresh } = useSimpleList<TaxRule>("/tax-rules");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("rate"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.rate}%</Typography> },
          { label: t("appliesTo"), render: (row) => <Typography sx={{ textTransform: "capitalize" }}>{row.appliesTo}</Typography> },
          { label: t("region"), render: (row) => row.region ?? "—" },
          { label: t("status"), render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("emptyTaxRulesTitle")}
        emptySubtitle={t("emptyTaxRulesSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newTaxRule")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newTaxRule")}
        fields={[
          { name: "name", label: t("name"), required: true },
          { name: "rate", label: t("ratePercent"), type: "number", required: true },
          { name: "appliesTo", label: t("appliesTo"), type: "select", required: true, options: [
            { value: "product", label: t("product") }, { value: "category", label: t("category") }, { value: "region", label: t("region") },
          ] },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/tax-rules", { method: "POST", body: { name: values.name, rate: Number(values.rate), appliesTo: values.appliesTo } });
            toastSuccess(t("toastTaxRuleCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreateTaxRule"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createRule")}
      />
    </>
  );
}

function PriceListsTab() {
  const t = useTranslations("catalog");
  const { rows, loading, refresh } = useSimpleList<PriceList>("/price-lists");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: t("default"), render: (row) => (row.isDefault ? <StatusChip status="active" /> : "—") },
          { label: t("items"), render: (row) => row.items },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("emptyPriceListsTitle")}
        emptySubtitle={t("emptyPriceListsSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newPriceList")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newPriceList")}
        fields={[
          { name: "name", label: t("name"), required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/price-lists", { method: "POST", body: { name: values.name } });
            toastSuccess(t("toastPriceListCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errCreatePriceList"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createPriceList")}
      />
    </>
  );
}

function ReorderRulesTab() {
  const t = useTranslations("catalog");
  const { rows, loading, refresh } = useSimpleList<ReorderRule>("/reorder-rules");
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const openCreate = async () => {
    try {
      const [productRows, warehouseRows] = await Promise.all([
        api<{ items: { id: string; sku: string; name: string }[] }>("/products?page=1&pageSize=100"),
        api<Warehouse[]>("/warehouses"),
      ]);
      setProducts(productRows.items);
      setWarehouses(warehouseRows);
      setCreateOpen(true);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errLoadReferenceData"));
    }
  };

  const remove = async (rule: ReorderRule) => {
    const ok = await confirmAction({ title: t("deleteRuleTitle"), text: t("deleteRuleText"), confirmText: t("delete") });
    if (!ok) return;
    try {
      await api(`/reorder-rules/${rule.id}`, { method: "DELETE" });
      toastSuccess(t("toastRuleDeleted"));
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errDeleteRule"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("product"), render: (row) => `#${row.productId.slice(-6)}` },
          { label: t("warehouse"), render: (row) => `#${row.warehouseId.slice(-6)}` },
          { label: t("min"), render: (row) => row.minQuantity },
          { label: t("max"), render: (row) => row.maxQuantity },
          { label: t("enabled"), render: (row) => (row.enabled ? <StatusChip status="active" /> : <StatusChip status="inactive" />) },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("emptyReorderRulesTitle")}
        emptySubtitle={t("emptyReorderRulesSubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>{t("newRule")}</Button>
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
        title={t("newReorderRule")}
        fields={[
          { name: "productId", label: t("product"), type: "select", required: true, options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "warehouseId", label: t("warehouse"), type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "minQuantity", label: t("minQuantity"), type: "number", required: true },
          { name: "maxQuantity", label: t("maxQuantity"), type: "number", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/reorder-rules", {
              method: "POST",
              body: {
                productId: values.productId,
                warehouseId: values.warehouseId,
                minQuantity: Number(values.minQuantity),
                maxQuantity: Number(values.maxQuantity),
              },
            });
            toastSuccess(t("toastReorderRuleSaved"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errSaveRule"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("saveRule")}
      />
    </>
  );
}

export default function CatalogPage() {
  const t = useTranslations("catalog");
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
          <Tab label={t("tabProducts")} />
          <Tab label={t("tabCategories")} />
          <Tab label={t("tabTaxRules")} />
          <Tab label={t("tabPriceLists")} />
          <Tab label={t("tabReorderRules")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <ProductsTab />}
      {tab === 1 && <CategoriesTab />}
      {tab === 2 && <TaxRulesTab />}
      {tab === 3 && <PriceListsTab />}
      {tab === 4 && <ReorderRulesTab />}
    </AppShell>
  );
}