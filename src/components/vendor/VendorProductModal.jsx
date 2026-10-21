import { Button, Input, ImageUploadDropzone } from "../ui";
import CategoryPicker from "../admin/CategoryPicker";

/**
 * Add / Edit Product modal for Vendor Dashboard.
 */
export default function VendorProductModal({
  isOpen,
  onClose,
  editingProduct,
  productForm,
  setProductForm,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          maxWidth: 540,
          width: "100%",
          padding: 28,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 18 }}>
          {editingProduct ? "Edit Product Listing" : "Add New Product to Store"}
        </h3>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              Product Title
            </label>
            <Input
              type="text"
              placeholder="e.g. Wireless Pro Earbuds"
              value={productForm.title}
              onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                Selling Price (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="99.99"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                Original Price (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="129.99"
                value={productForm.original_price}
                onChange={(e) => setProductForm({ ...productForm, original_price: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                Category
              </label>
              <CategoryPicker
                value={productForm.category_id}
                label={productForm.category}
                onChange={(id, name) =>
                  setProductForm({
                    ...productForm,
                    category_id: id,
                    category: name ?? productForm.category,
                  })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                Stock Quantity
              </label>
              <Input
                type="number"
                placeholder="20"
                value={productForm.stock}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <ImageUploadDropzone
              value={productForm.image_url}
              onChange={(url) => setProductForm({ ...productForm, image_url: url })}
              folder="marvel_products"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Product features and specifications..."
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button type="submit" variant="primary" style={{ flex: 1, background: "#7c3aed" }}>
              {editingProduct ? "Save Changes" : "Publish to Store"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
