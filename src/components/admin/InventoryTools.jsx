import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Check, Package, RefreshCw } from "lucide-react";
import { Button, Input } from "../ui";
import { LOW_STOCK_THRESHOLD } from "./adminConstants";

/** The units on hand, or zero when the API never sent a number. */
function stockOf(product) {
  const value = Number(product?.stock);
  return Number.isFinite(value) ? value : 0;
}

/** The stock after an adjustment: an absolute value, or a delta from the current one. */
function computeNextStock(currentStock, rawValue) {
  const text = String(rawValue ?? "").trim();
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isInteger(value)) return null;
  if (text.trim().startsWith("-")) {
    const next = currentStock + value;
    return next >= 0 ? next : null;
  }
  return Math.max(0, value);
}

/**
 * The console's Inventory sub-tab.
 *
 * It reads the catalogue the console already loaded — no second fetch — and
 * splits it into the low-stock and the out-of-stock watchlists. A stock write
 * goes through the single or the bulk endpoint, and the console owns the state
 * so the rest of the tab sees the new numbers.
 */
export default function InventoryTools({
  products = [],
  threshold,
  onThresholdChange,
  onAdjustStock,
  onBulkAdjustStock,
}) {
  const lowStockThreshold =
    Number.isFinite(Number(threshold)) && Number(threshold) >= 0
      ? Number(threshold)
      : LOW_STOCK_THRESHOLD;
  const setLowStockThreshold = (value) => {
    const next = Number(value);
    const safe = Number.isFinite(next) && next >= 0 ? next : 0;
    if (onThresholdChange) onThresholdChange(safe);
  };
  const [adjustments, setAdjustments] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStock, setBulkStock] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [applyingBulk, setApplyingBulk] = useState(false);

  const lowStockProducts = useMemo(
    () =>
      products.filter((product) => {
        const stock = stockOf(product);
        return stock > 0 && stock <= lowStockThreshold;
      }),
    [products, lowStockThreshold]
  );

  const outOfStockProducts = useMemo(
    () => products.filter((product) => stockOf(product) <= 0),
    [products]
  );

  const watchlist = useMemo(
    () => [...lowStockProducts, ...outOfStockProducts],
    [lowStockProducts, outOfStockProducts]
  );

  const adjustmentFor = (productId) => adjustments[productId] ?? { stock: "", reason: "" };

  const setAdjustmentFor = (productId, patch) => {
    setAdjustments((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? { stock: "", reason: "" }), ...patch },
    }));
  };

  const toggleSelect = (productId, isSelected) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const handleAdjustStock = async (product) => {
    const nextStock = computeNextStock(stockOf(product), adjustmentFor(product.id).stock);
    if (nextStock === null) return;
    setSavingId(product.id);
    try {
      await onAdjustStock?.(product.id, {
        stock: nextStock,
        reason: adjustmentFor(product.id).reason.trim() || null,
      });
      setAdjustmentFor(product.id, { stock: "", reason: "" });
    } finally {
      setSavingId(null);
    }
  };

  const handleApplyBulk = async () => {
    const text = String(bulkStock ?? "").trim();
    const value = Number(text);
    if (!Number.isInteger(value) || value < 0) return;

    const adjustmentsPayload = [];
    for (const product of watchlist) {
      if (!selected.has(product.id)) continue;
      const nextStock = text.trim().startsWith("-") ? stockOf(product) + value : value;
      if (nextStock < 0) continue;
      adjustmentsPayload.push({ id: product.id, stock: nextStock });
    }

    if (adjustmentsPayload.length === 0) return;
    setApplyingBulk(true);
    try {
      await onBulkAdjustStock?.(adjustmentsPayload);
      setSelected(new Set());
      setBulkStock("");
    } finally {
      setApplyingBulk(false);
    }
  };

  const renderWatchRow = (product) => {
    const stock = stockOf(product);
    const adjustment = adjustmentFor(product.id);
    const isLow = stock > 0 && stock <= lowStockThreshold;

    return (
      <li key={product.id} className="admin-inventory-row">
        <label className="admin-inventory-select">
          <input
            type="checkbox"
            checked={selected.has(product.id)}
            onChange={(event) => toggleSelect(product.id, event.target.checked)}
            aria-label={`Select ${product.title} for a bulk stock adjustment`}
          />
          <span>Select</span>
        </label>
        <div className="admin-inventory-row-main">
          <div className="admin-inventory-row-title">
            {product.image_url || product.image ? (
              <img
                src={product.image_url || product.image}
                alt=""
                className="admin-inventory-thumb"
              />
            ) : (
              <span className="admin-inventory-thumb admin-inventory-thumb--empty">
                <Package size={14} />
              </span>
            )}
            <span>{product.title}</span>
          </div>
          <span className={`stock-pill ${stock <= 0 ? "out" : isLow ? "low" : "ok"}`}>
            {stock} in stock
          </span>
        </div>
        <div className="admin-inventory-row-actions">
          <Input
            type="number"
            min={0}
            step={1}
            value={adjustment.stock}
            onChange={(event) => setAdjustmentFor(product.id, { stock: event.target.value })}
            placeholder="New stock"
            aria-label={`New stock for ${product.title}`}
          />
          <Input
            type="text"
            value={adjustment.reason}
            onChange={(event) => setAdjustmentFor(product.id, { reason: event.target.value })}
            placeholder="Reason"
            aria-label={`Stock adjustment reason for ${product.title}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={savingId === product.id || adjustment.stock.trim() === ""}
            onClick={() => handleAdjustStock(product)}
          >
            {savingId === product.id ? (
              <RefreshCw size={14} className="spin-animation" />
            ) : (
              <Check size={14} />
            )}
            Adjust
          </Button>
        </div>
      </li>
    );
  };

  return (
    <section className="admin-inventory-tools" aria-label="Inventory tools">
      <div className="admin-inventory-header">
        <div>
          <h2 className="admin-inventory-title">Inventory</h2>
          <p className="admin-inventory-subtitle">
            Low-stock and out-of-stock products from the catalogue you already loaded, with stock
            writes.
          </p>
        </div>
        <div className="admin-inventory-threshold">
          <label className="form-label" htmlFor="inventory-threshold">
            Low stock at or below
          </label>
          <Input
            id="inventory-threshold"
            type="number"
            min={0}
            step={1}
            value={String(lowStockThreshold)}
            onChange={(event) => setLowStockThreshold(Number(event.target.value) || 0)}
          />
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="admin-inventory-empty">
          <Boxes size={26} className="empty-icon" />
          <p>No products need a stock write right now.</p>
        </div>
      ) : (
        <>
          <div className="admin-inventory-group">
            <h3 className="admin-inventory-group-title">
              Low stock <span className="pill-count">{lowStockProducts.length}</span>
            </h3>
            <ul className="admin-inventory-list">{lowStockProducts.map(renderWatchRow)}</ul>
          </div>
          <div className="admin-inventory-group">
            <h3 className="admin-inventory-group-title">
              Out of stock <span className="pill-count">{outOfStockProducts.length}</span>
            </h3>
            <ul className="admin-inventory-list">{outOfStockProducts.map(renderWatchRow)}</ul>
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div className="admin-inventory-bulk">
          <span className="admin-inventory-bulk-count">
            <AlertTriangle size={14} /> {selected.size} selected
          </span>
          <Input
            type="number"
            min={0}
            step={1}
            value={bulkStock}
            onChange={(event) => setBulkStock(event.target.value)}
            placeholder="Adjustment (e.g. -2 or 10)"
            aria-label="Bulk stock adjustment"
          />
          <Button
            type="button"
            variant="accent"
            size="sm"
            disabled={applyingBulk || bulkStock.trim() === ""}
            onClick={handleApplyBulk}
          >
            {applyingBulk ? (
              <RefreshCw size={14} className="spin-animation" />
            ) : (
              <Check size={14} />
            )}
            Apply to Selected
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </section>
  );
}
