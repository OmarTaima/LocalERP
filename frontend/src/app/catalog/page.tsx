"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { AvatarUpload } from "@/components/avatar-upload";
import { useList, useSimpleList, currency, dateShort } from "@/lib/use-list";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Product = { id: string; sku: string; name: string; brand: string; categoryId: string | null; price: number; cost: number; lowStockThreshold: number; images: string[]; isActive: boolean; createdAt: string };
type Category = { id: string; name: string; slug: string; parentId: string | null; order: number };
type TaxRule = { id: string; name: string; rate: number; appliesTo: string; region: string | null; isActive: boolean };
type PriceList = { id: string; name: string; isDefault: boolean; items: number };
type ReorderRule = { id: string; productId: string; warehouseId: string; minQuantity: number; maxQuantity: number; enabled: boolean };
type Warehouse = { id: string; name: string; isDefault: boolean; isActive: boolean };

function ProductsTab() {
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
      toastError(err instanceof Error ? err.message : "failed to load categories");
    }
  };

  const openEdit = async (product: Product) => {
    try {
      const categoryRows = await api<Category[]>("/categories");
      setCategories(categoryRows);
      setEditImage(null);
      setEditingProduct(product);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to load categories");
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
      toastError(err instanceof Error ? err.message : "failed to load warehouses");
    }
  };

  const deactivate = async (product: Product) => {
    const ok = await confirmAction({ title: `Deactivate ${product.sku}?`, text: "Inactive products can no longer be sold or purchased.", confirmText: "Deactivate" });
    if (!ok) return;
    try {
      await api(`/products/${product.id}`, { method: "PATCH", body: { isActive: false } });
      toastSuccess("Product deactivated");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to deactivate product");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          {
            label: "Photo",
            render: (row) =>
              row.images?.[0] ? (
                <Box component="img" src={assetUrl(row.images[0])} alt={row.name} sx={{ width: 40, height: 40, borderRadius: 2, objectFit: "cover" }} />
              ) : (
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Inventory2OutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
              ),
          },
          { label: "SKU", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.sku}</Typography> },
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Brand", render: (row) => row.brand || "—" },
          { label: "Price", render: (row) => currency(row.price) },
          { label: "Cost", render: (row) => currency(row.cost) },
          { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
          { label: "Created", render: (row) => dateShort(row.createdAt) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No products yet"
        emptySubtitle="Products are the foundation of sales, inventory and manufacturing"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New product</Button>
        }
        rowActions={(row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {canEditProduct && (
              <Button size="small" variant="outlined" aria-label={`Edit ${row.name}`} onClick={() => void openEdit(row)}>
                <EditIcon fontSize="small" />
              </Button>
            )}
            <Button size="small" variant="outlined" onClick={() => void openAdjust(row)}>Adjust stock</Button>
            {row.isActive && <Button size="small" variant="text" color="error" onClick={() => void deactivate(row)}>Deactivate</Button>}
          </Stack>
        )}
      />
      <FormDialog
        open={createOpen}
        title="New product"
        fields={[
          { name: "sku", label: "SKU", required: true },
          { name: "name", label: "Name", required: true },
          { name: "categoryId", label: "Category", type: "select", options: [{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
          { name: "brand", label: "Brand" },
          { name: "price", label: "Selling price", type: "number", required: true },
          { name: "cost", label: "Cost", type: "number", required: true },
          { name: "lowStockThreshold", label: "Low stock threshold", type: "number", defaultValue: 5 },
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
            toastSuccess("Product created");
            setCreateOpen(false);
            setProductImage(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create product");
          }
        }}
        onClose={() => { setCreateOpen(false); setProductImage(null); }}
        submitLabel="Create product"
      >
        <AvatarUpload
          value={productImage}
          onChange={setProductImage}
          size={72}
          shape="square"
          placeholderIcon={<Inventory2OutlinedIcon sx={{ fontSize: 34 }} />}
        />
      </FormDialog>
      <FormDialog
        key={editingProduct ? `edit-${editingProduct.id}` : "new-product"}
        open={editingProduct !== null}
        title={editingProduct ? `Edit ${editingProduct.name}` : "Edit product"}
        subtitle="Update the product details and photo"
        fields={[
          { name: "sku", label: "SKU", required: true, defaultValue: editingProduct?.sku },
          { name: "name", label: "Name", required: true, defaultValue: editingProduct?.name },
          { name: "categoryId", label: "Category", type: "select", options: [{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))], defaultValue: editingProduct?.categoryId ?? "" },
          { name: "brand", label: "Brand", defaultValue: editingProduct?.brand },
          { name: "price", label: "Selling price", type: "number", required: true, defaultValue: editingProduct?.price },
          { name: "cost", label: "Cost", type: "number", required: true, defaultValue: editingProduct?.cost },
          { name: "lowStockThreshold", label: "Low stock threshold", type: "number", defaultValue: editingProduct?.lowStockThreshold },
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
            toastSuccess("Product updated");
            closeEdit();
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to update product");
          }
        }}
        onClose={closeEdit}
        submitLabel="Save changes"
      >
        <AvatarUpload
          value={editImage ?? (assetUrl(editingProduct?.images[0]) ?? null)}
          onChange={setEditImage}
          size={72}
          shape="square"
          placeholderIcon={<Inventory2OutlinedIcon sx={{ fontSize: 34 }} />}
        />
      </FormDialog>
      <FormDialog
        open={adjustFor !== null}
        title={`Adjust stock — ${adjustFor?.sku ?? ""}`}
        subtitle="Positive adds stock, negative removes it"
        fields={[
          { name: "warehouseId", label: "Warehouse", type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "quantity", label: "Quantity (non-zero)", type: "number", required: true },
          { name: "note", label: "Note" },
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
            toastSuccess("Stock adjusted");
            setAdjustFor(null);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to adjust stock");
          }
        }}
        onClose={() => setAdjustFor(null)}
        submitLabel="Adjust"
      />
    </>
  );
}

function CategoriesTab() {
  const { rows, loading, refresh } = useSimpleList<Category>("/categories");
  const [createOpen, setCreateOpen] = useState(false);

  const remove = async (category: Category) => {
    const ok = await confirmAction({ title: `Delete ${category.name}?`, text: "Categories with subcategories or products cannot be deleted.", confirmText: "Delete" });
    if (!ok) return;
    try {
      await api(`/categories/${category.id}`, { method: "DELETE" });
      toastSuccess("Category deleted");
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to delete category");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Slug", render: (row) => row.slug },
          { label: "Parent", render: (row) => (row.parentId ? `#${row.parentId.slice(-6)}` : "—") },
          { label: "Order", render: (row) => row.order },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No categories"
        emptySubtitle="Organize products into categories"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New category</Button>
        }
        rowActions={(row) => <Button size="small" variant="text" color="error" onClick={() => void remove(row)}>Delete</Button>}
      />
      <FormDialog
        open={createOpen}
        title="New category"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "slug", label: "Slug (lowercase, hyphens)" },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/categories", { method: "POST", body: { name: values.name, ...(values.slug ? { slug: values.slug } : {}) } });
            toastSuccess("Category created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create category");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create category"
      />
    </>
  );
}

function TaxRulesTab() {
  const { rows, loading, refresh } = useSimpleList<TaxRule>("/tax-rules");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Rate", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.rate}%</Typography> },
          { label: "Applies to", render: (row) => <Typography sx={{ textTransform: "capitalize" }}>{row.appliesTo}</Typography> },
          { label: "Region", render: (row) => row.region ?? "—" },
          { label: "Status", render: (row) => <StatusChip status={row.isActive ? "active" : "inactive"} /> },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No tax rules"
        emptySubtitle="Tax rules apply rates to products, categories or regions"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New tax rule</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New tax rule"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "rate", label: "Rate (%)", type: "number", required: true },
          { name: "appliesTo", label: "Applies to", type: "select", required: true, options: [
            { value: "product", label: "Product" }, { value: "category", label: "Category" }, { value: "region", label: "Region" },
          ] },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/tax-rules", { method: "POST", body: { name: values.name, rate: Number(values.rate), appliesTo: values.appliesTo } });
            toastSuccess("Tax rule created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create tax rule");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create rule"
      />
    </>
  );
}

function PriceListsTab() {
  const { rows, loading, refresh } = useSimpleList<PriceList>("/price-lists");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</Typography> },
          { label: "Default", render: (row) => (row.isDefault ? <StatusChip status="active" /> : "—") },
          { label: "Items", render: (row) => row.items },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No price lists"
        emptySubtitle="Price lists override catalog prices per segment"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New price list</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New price list"
        fields={[
          { name: "name", label: "Name", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/price-lists", { method: "POST", body: { name: values.name } });
            toastSuccess("Price list created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create price list");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create price list"
      />
    </>
  );
}

function ReorderRulesTab() {
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
      toastError(err instanceof Error ? err.message : "failed to load reference data");
    }
  };

  const remove = async (rule: ReorderRule) => {
    const ok = await confirmAction({ title: "Delete reorder rule?", text: "The product will no longer be auto-reordered.", confirmText: "Delete" });
    if (!ok) return;
    try {
      await api(`/reorder-rules/${rule.id}`, { method: "DELETE" });
      toastSuccess("Rule deleted");
      refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to delete rule");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Product", render: (row) => `#${row.productId.slice(-6)}` },
          { label: "Warehouse", render: (row) => `#${row.warehouseId.slice(-6)}` },
          { label: "Min", render: (row) => row.minQuantity },
          { label: "Max", render: (row) => row.maxQuantity },
          { label: "Enabled", render: (row) => (row.enabled ? <StatusChip status="active" /> : <StatusChip status="inactive" />) },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No reorder rules"
        emptySubtitle="Rules trigger replenishment when stock drops below the minimum"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void openCreate()}>New rule</Button>
        }
        rowActions={(row) => <Button size="small" variant="text" color="error" onClick={() => void remove(row)}>Delete</Button>}
      />
      <FormDialog
        open={createOpen}
        title="New reorder rule"
        fields={[
          { name: "productId", label: "Product", type: "select", required: true, options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "warehouseId", label: "Warehouse", type: "select", required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
          { name: "minQuantity", label: "Min quantity", type: "number", required: true },
          { name: "maxQuantity", label: "Max quantity", type: "number", required: true },
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
            toastSuccess("Reorder rule saved");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to save rule");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Save rule"
      />
    </>
  );
}

export default function CatalogPage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Catalog" subtitle="Manage the products you sell, plus categories, pricing and tax rules." />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Products" />
          <Tab label="Categories" />
          <Tab label="Tax rules" />
          <Tab label="Price lists" />
          <Tab label="Reorder rules" />
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