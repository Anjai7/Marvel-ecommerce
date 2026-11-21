import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { AuthContext } from "./AuthContext";
import { apiFetchCart, apiSaveCart, apiClearCart } from "../api/backendApi";

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

function parseStoredItems(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      item && typeof item === "object" ? { ...item, lineId: item.lineId ?? lineIdFor(item) } : item
    );
  } catch {
    return [];
  }
}

function getUserStorageKey(user) {
  if (!user) return null;
  if (user.id !== undefined && user.id !== null) {
    return `marvel_cart_user_${user.id}`;
  }
  if (user.email && typeof user.email === "string") {
    return `marvel_cart_user_${user.email.trim().toLowerCase()}`;
  }
  return null;
}

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseStoredItems(raw);
  } catch {
    return [];
  }
}

/**
 * Merge a guest cart into an account cart.
 *
 * Quantity adds up when the same line is in both, so signing in never
 * quietly drops what the customer picked while browsing logged out.
 */
function mergeCarts(accountItems, guestItems) {
  const merged = parseStoredItems(JSON.stringify(accountItems));
  for (const guest of guestItems) {
    const existing = merged.find((item) => sameLine(item, guest));
    if (existing) existing.quantity += Number(guest.quantity) || 1;
    else merged.push({ ...guest, lineId: guest.lineId ?? lineIdFor(guest) });
  }
  return merged;
}

export function CartProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const isLoggedIn = auth?.isLoggedIn ?? false;
  const userKey = getUserStorageKey(user);

  // A visitor keeps a local cart. A signed-in customer uses a per-user key
  // and mirrors the same lines to the backend.
  const [items, setItems] = useState(() => {
    if (isLoggedIn && userKey) {
      try {
        return parseStoredItems(localStorage.getItem(userKey));
      } catch {
        return [];
      }
    }
    return loadInitialCart();
  });

  const activeUserKeyRef = useRef(userKey);
  // The effect below also runs on mount. Without this, a guest's first render
  // would be treated as a logout and their local cart would be wiped.
  const wasLoggedInRef = useRef(isLoggedIn);

  // On login, fold whatever was picked while logged out into the account's
  // cart and drop the guest copy. Logout empties the visible cart but keeps
  // the stored account cart, so signing back in restores it.
  useEffect(() => {
    if (!auth) return;
    const authChanged = wasLoggedInRef.current !== isLoggedIn;
    wasLoggedInRef.current = isLoggedIn;

    if (isLoggedIn && userKey) {
      let next = parseStoredItems(localStorage.getItem(userKey));
      try {
        const guest = parseStoredItems(localStorage.getItem(STORAGE_KEY));
        if (guest.length) {
          next = mergeCarts(next, guest);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // storage unavailable — keep the account cart
      }
      setItems(next);
      activeUserKeyRef.current = userKey;

      // The backend copy is additive: a slow read must not overwrite a line
      // the customer just changed in this browser.
      if (user?.id) {
        apiFetchCart(user.id)
          .then((stored) => {
            if (stored.length) setItems((current) => mergeCarts(current, stored));
          })
          .catch(() => {});
      }
    } else if (authChanged) {
      setItems([]);
      activeUserKeyRef.current = null;
    }
  }, [auth, isLoggedIn, userKey, user?.id]);

  // localStorage stays authoritative while a backend write is in flight.
  useEffect(() => {
    try {
      if (isLoggedIn && userKey) localStorage.setItem(userKey, JSON.stringify(items));
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable — ignore
    }
  }, [items, auth, isLoggedIn, userKey]);

  // Mirror to the backend after the local write settles, so holding down a
  // quantity button does not send one request per click. Best effort: a
  // failed request never stops someone shopping.
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return undefined;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiSaveCart(user.id, items).catch(() => {});
    }, 400);
    return () => clearTimeout(saveTimerRef.current);
  }, [items, isLoggedIn, user?.id]);

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
    return true;
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
    try {
      if (userKey) {
        localStorage.removeItem(userKey);
      }
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  useEffect(() => {
    const handleLogout = () => {
      setItems([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    };
    if (typeof window !== "undefined") {
      window.addEventListener("marvel:auth:logout", handleLogout);
      return () => window.removeEventListener("marvel:auth:logout", handleLogout);
    }
  }, []);

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
