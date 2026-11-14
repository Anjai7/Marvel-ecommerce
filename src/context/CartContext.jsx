import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "marvel_cart";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500";

/**
 * The choice the customer made, as the cart carries it: `[{ kind, label, value }]`.
 *
 * A stored line may carry anything, so every option is read defensively and
 * an option without a kind or without a label is dropped — it could not be
 * shown to the customer anyway.
 */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  const rows = [];
  for (const option of options) {
    if (!option || typeof option !== "object") continue;
    const kind = typeof option.kind === "string" ? option.kind.trim() : "";
    const label = typeof option.label === "string" ? option.label.trim() : "";
    if (!kind || !label) continue;
    const value = option.value == null ? null : String(option.value).trim() || null;
    rows.push({ kind, label, value });
  }
  return rows;
}

/** A short, stable fingerprint of a choice — "color:Blue|size:M". */
function optionsSignature(options) {
  if (!Array.isArray(options) || options.length === 0) return "";
  return options
    .map((option) => `${option.kind}:${option.label}`)
    .sort()
    .join("|");
}

/**
 * The stable key of one cart line.
 *
 * The product and the combination it was bought as are enough to tell the
 * lines apart; a line without a combination falls back to its choice, so two
 * different choices of the same product stay two lines.
 */
function lineIdFor(item) {
  const combination = item.combination_id ?? "";
  const choice = combination ? "" : optionsSignature(item.options);
  const parts = [item.id, combination];
  if (choice) parts.push(choice);
  return parts.join("::");
}

/**
 * Are two items the same cart line?
 *
 * The product id and the combination decide it: "Blue / M" and "Red / M" of
 * the same product are two lines, while the same combination added twice is
 * one line whose quantity grows.
 */
function sameLine(first, second) {
  if (first.id !== second.id) return false;
  const firstCombination = first.combination_id ?? null;
  const secondCombination = second.combination_id ?? null;
  if (firstCombination !== secondCombination) return false;
  if (firstCombination !== null) return true;
  return optionsSignature(first.options) === optionsSignature(second.options);
}

/**
 * Does a line answer to the id the caller passed?
 *
 * A caller may address a line by its `lineId` ("p1::combo-1") or by the
 * product id alone. A bare product id still matches every line of that
 * product, so the callers that know nothing about combinations keep working.
 */
function matchesTarget(item, id, combinationId) {
  if (id === undefined || id === null) return false;
  const target = String(id);
  if (item.lineId && item.lineId === target) return true;
  if (String(item.id) !== target) return false;
  if (combinationId === undefined || combinationId === null) return true;
  return (item.combination_id ?? null) === combinationId;
}

export function normalizeProduct(product = {}) {
  return {
    id: product.id ?? product.title ?? product.name,
    title: product.title || product.name || "Product",
    price: Number(product.price) || 0,
    originalPrice: product.original_price ?? product.originalPrice ?? null,
    image: product.image_url || product.image || FALLBACK_IMAGE,
    category: product.category || product.tag || "",
    sku: product.sku == null ? null : String(product.sku).trim() || null,
    combination_id: product.combination_id ?? product.combinationId ?? null,
    options: normalizeOptions(product.options),
  };
}

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      item && typeof item === "object" ? { ...item, lineId: item.lineId ?? lineIdFor(item) } : item
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable — ignore
    }
  }, [items]);

  const addItem = (product, qty = 1) => {
    const normalized = normalizeProduct(product);
    const amount = Number(qty) || 1;
    setItems((prev) => {
      const existing = prev.find((item) => sameLine(item, normalized));
      if (existing) {
        return prev.map((item) =>
          sameLine(item, normalized) ? { ...item, quantity: item.quantity + amount } : item
        );
      }
      return [...prev, { ...normalized, lineId: lineIdFor(normalized), quantity: amount }];
    });
  };

  const removeItem = (id, combinationId) => {
    setItems((prev) => prev.filter((item) => !matchesTarget(item, id, combinationId)));
  };

  const updateQuantity = (id, qty, combinationId) => {
    setItems((prev) => {
      const clamped = Math.max(1, Number(qty) || 1);
      let matched = false;
      const next = prev.map((item) => {
        if (!matchesTarget(item, id, combinationId)) return item;
        matched = true;
        return { ...item, quantity: clamped };
      });
      return matched ? next : prev;
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const { cartCount, subtotal, savings, total } = useMemo(() => {
    let count = 0;
    let sub = 0;
    let save = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      count += qty;
      sub += price * qty;
      const original = Number(item.originalPrice);
      if (item.originalPrice != null && original > price) {
        save += (original - price) * qty;
      }
    }
    return { cartCount: count, subtotal: sub, savings: save, total: sub };
  }, [items]);

  const value = {
    items,
    cartCount,
    subtotal,
    savings,
    total,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
