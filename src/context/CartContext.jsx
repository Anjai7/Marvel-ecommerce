import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "marvel_cart";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500";

export function normalizeProduct(product = {}) {
  return {
    id: product.id ?? product.title ?? product.name,
    title: product.title || product.name || "Product",
    price: Number(product.price) || 0,
    originalPrice: product.original_price ?? product.originalPrice ?? null,
    image: product.image_url || product.image || FALLBACK_IMAGE,
    category: product.category || product.tag || "",
  };
}

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
      const existing = prev.find((item) => item.id === normalized.id);
      if (existing) {
        return prev.map((item) =>
          item.id === normalized.id ? { ...item, quantity: item.quantity + amount } : item
        );
      }
      return [...prev, { ...normalized, quantity: amount }];
    });
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, qty) => {
    setItems((prev) => {
      if (!prev.some((item) => item.id === id)) return prev;
      const clamped = Math.max(1, Number(qty) || 1);
      return prev.map((item) => (item.id === id ? { ...item, quantity: clamped } : item));
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
