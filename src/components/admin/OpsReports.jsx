import { useMemo } from "react";
import { Boxes, IndianRupee, ShoppingBag, Users } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { parseAmount, summarizeInventory } from "./reportUtils";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatAdminDate } from "./adminConstants";

/**
 * The console's store analytics: figures derived from the orders, products and
 * customers the console already loads — no extra endpoints, no cached numbers.
 */
export default function OpsReports({ orders = [], products = [], users = [] }) {
  const report = useMemo(() => {
    const orderList = Array.isArray(orders) ? orders : [];
    const productList = Array.isArray(products) ? products : [];
    const userList = Array.isArray(users) ? users : [];

    const ordersByStatus = { total: orderList.length };
    for (const status of ORDER_STATUSES) ordersByStatus[status] = 0;
    const revenueByStatus = {};
    let totalRevenue = 0;

    for (const order of orderList) {
      const status = String(order?.status ?? "")
        .trim()
        .toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(ordersByStatus, status)) continue;
      ordersByStatus[status] += 1;
      const revenue = parseAmount(order?.total_amount);
      revenueByStatus[status] = (revenueByStatus[status] ?? 0) + revenue;
      totalRevenue += revenue;
    }

    const inventory = summarizeInventory(productList);

    const newestCustomers = userList
      .filter((user) => (user?.role || "user") === "user")
      .slice()
      .sort(
        (a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime()
      )
      .slice(0, 5);

    const hasData = orderList.length > 0 || productList.length > 0 || userList.length > 0;

    return { ordersByStatus, revenueByStatus, totalRevenue, inventory, newestCustomers, hasData };
  }, [orders, products, users]);

  if (!report.hasData) {
    return (
      <section className="admin-ops-reports" aria-label="Store analytics">
        <div className="admin-ops-header">
          <div>
            <h2 className="admin-ops-title">Store Analytics</h2>
            <p className="admin-ops-subtitle">
              Live figures from the records the console already loads.
            </p>
          </div>
        </div>
        <div className="report-card">
          <p className="report-empty">No data yet.</p>
        </div>
      </section>
    );
  }

  const statusRows = ORDER_STATUSES.filter((status) => report.ordersByStatus[status] > 0).map(
    (status) => ({
      status,
      orders: report.ordersByStatus[status],
      revenue: report.revenueByStatus[status] ?? 0,
    })
  );

  return (
    <section className="admin-ops-reports" aria-label="Store analytics">
      <div className="admin-ops-header">
        <div>
          <h2 className="admin-ops-title">Store Analytics</h2>
          <p className="admin-ops-subtitle">
            Live figures from the orders, products and customers the console already loads.
          </p>
        </div>
      </div>

      <div className="reports-grid-2">
        <div className="report-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Orders by Status &amp; Revenue</h3>
              <p className="chart-subtitle">Every order placed, grouped by fulfilment stage</p>
            </div>
            <ShoppingBag size={18} className="text-muted" />
          </div>
          {statusRows.length === 0 ? (
            <p className="report-empty">No orders recorded yet.</p>
          ) : (
            <div className="ops-status-rows">
              {statusRows.map((row) => (
                <div key={row.status} className="ops-status-row">
                  <span className="ops-status-label">
                    {ORDER_STATUS_LABELS[row.status] || row.status}
                  </span>
                  <span className="ops-status-count">{row.orders} orders</span>
                  <span className="ops-status-revenue">{formatCurrency(row.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="report-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Inventory Snapshot</h3>
              <p className="chart-subtitle">
                Low-stock and out-of-stock counts from the live catalogue
              </p>
            </div>
            <Boxes size={18} className="text-muted" />
          </div>
          <div className="ops-inventory-stats">
            <div className="ops-inventory-stat">
              <span className="ops-inventory-stat-value">{report.inventory.lowStock}</span>
              <span className="ops-inventory-stat-label">Low stock</span>
            </div>
            <div className="ops-inventory-stat">
              <span className="ops-inventory-stat-value">{report.inventory.outOfStock}</span>
              <span className="ops-inventory-stat-label">Out of stock</span>
            </div>
            <div className="ops-inventory-stat">
              <span className="ops-inventory-stat-value">{report.inventory.inStock}</span>
              <span className="ops-inventory-stat-label">In stock</span>
            </div>
            <div className="ops-inventory-stat">
              <span className="ops-inventory-stat-value">
                {formatCurrency(report.inventory.value)}
              </span>
              <span className="ops-inventory-stat-label">Catalog value</span>
            </div>
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-title">Newest Customers</h3>
            <p className="chart-subtitle">The five most recently registered customer accounts</p>
          </div>
          <Users size={18} className="text-muted" />
        </div>
        {report.newestCustomers.length === 0 ? (
          <p className="report-empty">No customers registered yet.</p>
        ) : (
          <ul className="ops-customer-list">
            {report.newestCustomers.map((customer) => (
              <li key={customer.id ?? customer.email} className="ops-customer-row">
                <span className="ops-customer-name">{customer.full_name || customer.email}</span>
                <span className="ops-customer-email">{customer.email}</span>
                <span className="ops-customer-joined">{formatAdminDate(customer.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="report-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-title">Platform Totals</h3>
            <p className="chart-subtitle">Revenue across every recorded order</p>
          </div>
          <IndianRupee size={18} className="text-muted" />
        </div>
        <p className="ops-total-revenue">{formatCurrency(report.totalRevenue)}</p>
      </div>
    </section>
  );
}
