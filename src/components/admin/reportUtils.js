/* Pure reporting helpers for the admin console. No React, no network —
 * everything derives from already-fetched orders/products arrays. */

import { ORDER_STATUSES, isLowStock } from "./adminConstants";

export function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function orderDate(order) {
  if (!order || !order.created_at) return null;
  const d = new Date(order.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Revenue + order counts for the last `days` calendar days (oldest first). Zeros stay zero. */
export function lastNDayBuckets(orders = [], days = 7, now = new Date()) {
  const list = Array.isArray(orders) ? orders : [];
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDayKey(d);
    let revenue = 0;
    let ordersCount = 0;
    for (const order of list) {
      const od = orderDate(order);
      if (od && toDayKey(od) === key) {
        revenue += parseAmount(order.total_amount);
        ordersCount += 1;
      }
    }
    result.push({
      key,
      label: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      revenue,
      ordersCount,
    });
  }
  return result;
}

function inSameDay(a, b) {
  return toDayKey(a) === toDayKey(b);
}

/** Today / yesterday / this-month / last-month revenue + order counts. */
export function salesWindows(orders = [], now = new Date()) {
  const list = Array.isArray(orders) ? orders : [];
  const windows = {
    today: { revenue: 0, orders: 0 },
    yesterday: { revenue: 0, orders: 0 },
    thisMonth: { revenue: 0, orders: 0 },
    lastMonth: { revenue: 0, orders: 0 },
  };
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  for (const order of list) {
    const od = orderDate(order);
    if (!od) continue;
    const amt = parseAmount(order.total_amount);
    if (inSameDay(od, today)) {
      windows.today.revenue += amt;
      windows.today.orders += 1;
    } else if (inSameDay(od, yesterday)) {
      windows.yesterday.revenue += amt;
      windows.yesterday.orders += 1;
    }
    if (od >= monthStart) {
      windows.thisMonth.revenue += amt;
      windows.thisMonth.orders += 1;
    } else if (od >= lastMonthStart) {
      windows.lastMonth.revenue += amt;
      windows.lastMonth.orders += 1;
    }
  }
  return windows;
}

function windowRevenue(orders, start, end) {
  let sum = 0;
  for (const order of orders) {
    const od = orderDate(order);
    if (od && od >= start && od < end) sum += parseAmount(order.total_amount);
  }
  return sum;
}

/** Last-7-days revenue vs the prior 7 days. percent is null when prior is 0. */
export function revenueGrowth(orders = [], now = new Date()) {
  const list = Array.isArray(orders) ? orders : [];
  const endCurrent = new Date(now);
  const startCurrent = new Date(now);
  startCurrent.setDate(startCurrent.getDate() - 7);
  const startPrevious = new Date(now);
  startPrevious.setDate(startPrevious.getDate() - 14);
  const current = windowRevenue(list, startCurrent, endCurrent);
  const previous = windowRevenue(list, startPrevious, startCurrent);
  return {
    current,
    previous,
    percent: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/**
 * Order counts per fulfillment stage. Unknown statuses are not counted into any
 * stage — an order is never reported as a stage the database does not have.
 */
export function summarizeStatuses(orders = []) {
  const list = Array.isArray(orders) ? orders : [];
  const summary = {
    total: list.length,
    inFlight: 0,
  };
  for (const status of ORDER_STATUSES) summary[status] = 0;
  for (const order of list) {
    const raw = String(order?.status || "")
      .trim()
      .toLowerCase();
    if (ORDER_STATUSES.includes(raw)) summary[raw] += 1;
  }
  summary.inFlight = summary.processing + summary.shipped;
  return summary;
}

/**
 * Identity for repeat-buyer analysis.
 *
 * A signed-in order belongs to its `user_id`; only a guest (no `user_id`) is
 * keyed by the email they typed, and only failing that by their name. No email
 * address is special-cased.
 */
function customerKey(order) {
  if (order?.user_id) return String(order.user_id);
  const email = String(order?.customer_email || "")
    .trim()
    .toLowerCase();
  if (email) return email;
  const name = String(order?.customer_name || "").trim();
  return name ? `guest:${name}` : "guest";
}

/** Repeat-buyer analysis keyed by `user_id`, then guest email. Names come from the API only. */
export function computeRepeatCustomers(orders = []) {
  const list = Array.isArray(orders) ? orders : [];
  const byKey = new Map();
  for (const order of list) {
    const key = customerKey(order);
    const entry = byKey.get(key) || {
      key,
      name: String(order?.customer_name || "").trim() || null,
      email: String(order?.customer_email || "").trim() || null,
      orders: 0,
      spent: 0,
    };
    entry.orders += 1;
    entry.spent += parseAmount(order?.total_amount);
    if (!entry.name && order?.customer_name) entry.name = String(order.customer_name).trim();
    if (!entry.email && order?.customer_email) entry.email = String(order.customer_email).trim();
    byKey.set(key, entry);
  }
  const all = [...byKey.values()].sort((a, b) => b.spent - a.spent);
  const repeat = all.filter((c) => c.orders > 1);
  return {
    totalCustomers: all.length,
    repeatCustomers: repeat.length,
    repeatRate: all.length > 0 ? (repeat.length / all.length) * 100 : 0,
    top: repeat.slice(0, 5),
  };
}

function itemTitle(item) {
  return String(item?.title || item?.name || "").trim();
}

function itemQty(item) {
  return Math.max(1, parseInt(item?.quantity ?? item?.qty ?? 1, 10) || 1);
}

/** Best sellers aggregated from order line items. Untitled lines are skipped — a
 * product is never invented to hold their revenue. */
export function aggregateBestSellers(orders = [], limit = 5) {
  const list = Array.isArray(orders) ? orders : [];
  const byTitle = new Map();
  for (const order of list) {
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const item of items) {
      const title = itemTitle(item);
      if (!title) continue;
      const qty = itemQty(item);
      const revenue = parseAmount(item?.price) * qty;
      const entry = byTitle.get(title) || {
        title,
        image: item?.image || item?.image_url || "",
        qty: 0,
        revenue: 0,
      };
      entry.qty += qty;
      entry.revenue += revenue;
      if (!entry.image && (item?.image || item?.image_url))
        entry.image = item.image || item.image_url;
      byTitle.set(title, entry);
    }
  }
  return [...byTitle.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Inventory bands + total catalog value at selling price. */
export function summarizeInventory(products = []) {
  const list = Array.isArray(products) ? products : [];
  const summary = { total: list.length, inStock: 0, lowStock: 0, outOfStock: 0, value: 0 };
  for (const p of list) {
    const stock = parseInt(p?.stock, 10) || 0;
    if (stock <= 0) summary.outOfStock += 1;
    else {
      summary.inStock += 1;
      if (isLowStock(stock)) summary.lowStock += 1;
    }
    summary.value += parseAmount(p?.price) * stock;
  }
  return summary;
}

/** Per-customer rollups joining registered users with their order history. */
export function customerStats(users = [], orders = []) {
  const userList = Array.isArray(users) ? users : [];
  const orderList = Array.isArray(orders) ? orders : [];
  const byEmail = new Map();
  const byUserId = new Map();
  for (const order of orderList) {
    const email = String(order?.customer_email || "")
      .trim()
      .toLowerCase();
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(order);
    }
    if (order?.user_id) {
      const uid = String(order.user_id);
      if (!byUserId.has(uid)) byUserId.set(uid, []);
      byUserId.get(uid).push(order);
    }
  }
  return userList
    .filter((u) => (u?.role || "user") === "user")
    .map((u) => {
      const email = String(u?.email || "")
        .trim()
        .toLowerCase();
      const mine = new Map();
      for (const o of [...(byEmail.get(email) || []), ...(byUserId.get(String(u?.id)) || [])]) {
        mine.set(o?.id ?? `${o?.created_at}-${o?.total_amount}`, o);
      }
      const mineList = [...mine.values()];
      let spent = 0;
      let lastOrderAt = null;
      for (const o of mineList) {
        spent += parseAmount(o?.total_amount);
        if (o?.created_at && (!lastOrderAt || o.created_at > lastOrderAt))
          lastOrderAt = o.created_at;
      }
      return {
        id: u?.id,
        name: String(u?.full_name || "").trim() || null,
        email: u?.email || "",
        status: u?.status || "",
        joined: u?.created_at || null,
        orders: mineList.length,
        spent,
        lastOrderAt,
        repeat: mineList.length > 1,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}
