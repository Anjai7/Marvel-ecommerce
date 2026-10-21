/* Admin alerts — the notification bell in the console's top bar.
 *
 * An alert is derived from the live rows the console already fetched, never
 * from a stored notification: a bell count that disagrees with the Orders tab
 * would be worse than no bell. Each alert points at the tab that can act on
 * it, so clicking it takes the admin where the work is. */

import { AlertTriangle, AlertCircle, PackageCheck, Boxes, UserPlus } from "lucide-react";
import { isLowStock } from "./adminConstants";

/**
 * Build the alert list from live data.
 *
 * @param {object} data
 * @param {Array} data.orders every order
 * @param {Array} data.products every product
 * @param {Array} data.users every profile
 * @param {Date} [now] the moment "recent" is measured from
 * @returns {Array<{ id, tone, title, detail, tab, icon }>} most urgent first
 */
export function buildAlerts({ orders = [], products = [], users = [], now = new Date() } = {}) {
  const alerts = [];

  const pending = orders.filter((order) => order?.status === "pending");
  if (pending.length > 0) {
    alerts.push({
      id: "orders-pending",
      tone: "warning",
      title: `${pending.length} order${pending.length === 1 ? "" : "s"} awaiting fulfilment`,
      detail: "Orders sitting in the pending stage need to be accepted.",
      tab: "orders",
      icon: AlertTriangle,
    });
  }

  const inFlight = orders.filter(
    (order) => order?.status === "processing" || order?.status === "shipped"
  );
  if (inFlight.length > 0) {
    alerts.push({
      id: "orders-inflight",
      tone: "info",
      title: `${inFlight.length} order${inFlight.length === 1 ? "" : "s"} in flight`,
      detail: "Processing and shipped orders are on their way.",
      tab: "orders",
      icon: PackageCheck,
    });
  }

  const awaitingModeration = products.filter(
    (product) => product?.moderation_status && product.moderation_status !== "approved"
  );
  if (awaitingModeration.length > 0) {
    alerts.push({
      id: "products-moderation",
      tone: "warning",
      title: `${awaitingModeration.length} product${
        awaitingModeration.length === 1 ? "" : "s"
      } awaiting moderation`,
      detail: "Listed products that are not approved yet.",
      tab: "products",
      icon: AlertCircle,
    });
  }

  const lowStock = products.filter((product) => isLowStock(product?.stock));
  if (lowStock.length > 0) {
    alerts.push({
      id: "products-low-stock",
      tone: "warning",
      title: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} low on stock`,
      detail: "Stock has reached the low-stock threshold.",
      tab: "products",
      icon: Boxes,
    });
  }

  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const newCustomers = users.filter((user) => {
    if ((user?.role || "user") !== "user") return false;
    const joined = new Date(user?.created_at).getTime();
    return Number.isFinite(joined) && joined >= weekAgo;
  });
  if (newCustomers.length > 0) {
    alerts.push({
      id: "customers-new",
      tone: "info",
      title: `${newCustomers.length} new customer${newCustomers.length === 1 ? "" : "s"} this week`,
      detail: "Accounts registered in the last seven days.",
      tab: "customers",
      icon: UserPlus,
    });
  }

  return alerts;
}
