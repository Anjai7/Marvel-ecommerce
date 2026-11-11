import { Button, Input, ImageUploadDropzone, RequiredMark } from "../ui";
import CategoryPicker from "../admin/CategoryPicker";
import "./vendor-dashboard.css";

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
    <div className="vendor-modal__overlay">
      <div className="vendor-modal__dialog">
        <h3 className="vendor-modal__title">
          {editingProduct ? "Edit Product Listing" : "Add New Product to Store"}
        </h3>

        <form onSubmit={onSubmit} className="vendor-form">
          <div>
            <label className="vendor-field__label" htmlFor="vendor-product-title">
              Product Title <RequiredMark />
            </label>
            <Input
              id="vendor-product-title"
              type="text"
              placeholder="e.g. Wireless Pro Earbuds"
              value={productForm.title}
              onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
              required
            />
          </div>

          <div className="vendor-form__grid">
            <div>
              <label className="vendor-field__label" htmlFor="vendor-product-price">
                Selling Price (₹) <RequiredMark />
              </label>
              <Input
                id="vendor-product-price"
                type="number"
                step="0.01"
                placeholder="99.99"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="vendor-field__label" htmlFor="vendor-product-original-price">
                Original Price (₹)
              </label>
              <Input
                id="vendor-product-original-price"
                type="number"
                step="0.01"
                placeholder="129.99"
                value={productForm.original_price}
                onChange={(e) => setProductForm({ ...productForm, original_price: e.target.value })}
              />
            </div>
          </div>

          <div className="vendor-form__grid">
            <div>
              <label className="vendor-field__label" htmlFor="vendor-product-category">
                Category
              </label>
              <CategoryPicker
                id="vendor-product-category"
                value={productForm.category_id}
                label={productForm.category}
                onChange={(id, name) =>
                  setProductForm({
                    ...productForm,
                    category_id: id,
                    category: name ?? productForm.category,
                  })
                }
                className="vendor-field__control"
              />
            </div>
            <div>
              <label className="vendor-field__label" htmlFor="vendor-product-stock">
                Stock Quantity <RequiredMark />
              </label>
              <Input
                id="vendor-product-stock"
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
            <label className="vendor-field__label" htmlFor="vendor-product-description">
              Description
            </label>
            <textarea
              id="vendor-product-description"
              rows={3}
              placeholder="Product features and specifications..."
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="vendor-field__control vendor-field__control--textarea"
            />
          </div>

          <div className="vendor-form__actions">
            <Button
              type="submit"
              variant="primary"
              className="vendor-button--accent vendor-button--grow"
            >
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
