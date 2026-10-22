import { Truck, AlertTriangle, Users, Sparkles, ChevronRight, TrendingUp } from "lucide-react";

/**
 * OperationsHub: Shopify-style high-priority daily operational dashboard hub.
 * Surfaces actionable store priorities (orders to ship, stock alerts, live links).
 */
export default function OperationsHub({
  metrics,
  salesReport,
  onNavigateTab,
  onOpenAddProduct = () => {},
  userName = "Admin",
}) {
  const pendingOrProcessing =
    (metrics.processingOrders || 0) + (salesReport?.statuses?.pending || 0);

  const lowStockCount = metrics.lowStockProducts || 0;
  const totalCustomers = salesReport?.repeat?.totalCustomers || metrics.customersCount || 0;

  return (
    <div className="admin-operations-hub">
      <div className="operations-hub-header">
        <div>
          <h2 className="operations-hub-title">Store Operations Overview</h2>
          <p className="operations-hub-subtitle">
            Welcome back, {userName}. High-priority actions and store status for today.
          </p>
        </div>
      </div>

      <div className="operations-hub-cards">
        {/* Action Card 1: Orders Needing Fulfillment */}
        <div
          className={`hub-card ${pendingOrProcessing > 0 ? "highlight-amber" : ""}`}
          onClick={() => onNavigateTab("orders", "processing")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigateTab("orders", "processing");
          }}
        >
          <div className="hub-card-top">
            <div className="hub-card-icon amber">
              <Truck size={18} />
            </div>
            <span className="hub-card-count">{pendingOrProcessing}</span>
          </div>
          <div className="hub-card-title">Orders Awaiting Shipping</div>
          <div className="hub-card-hint">
            {pendingOrProcessing > 0
              ? "Items need packaging & label generation"
              : "All customer shipments up to date"}
          </div>
          <div className="hub-card-link">
            <span>Fulfill Orders</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Action Card 2: Low Stock Inventory Alert */}
        <div
          className={`hub-card ${lowStockCount > 0 ? "highlight-red" : ""}`}
          onClick={() => onNavigateTab("products", "list")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigateTab("products", "list");
          }}
        >
          <div className="hub-card-top">
            <div className="hub-card-icon red">
              <AlertTriangle size={18} />
            </div>
            <span className="hub-card-count">{lowStockCount}</span>
          </div>
          <div className="hub-card-title">Low Stock Inventory</div>
          <div className="hub-card-hint">
            {lowStockCount > 0
              ? `${lowStockCount} products are running critically low`
              : "Catalog stock levels are healthy"}
          </div>
          <div className="hub-card-link">
            <span>Review Catalog</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Action Card 3: Customer Base */}
        <div
          className="hub-card"
          onClick={() => onNavigateTab("customers", "all")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigateTab("customers", "all");
          }}
        >
          <div className="hub-card-top">
            <div className="hub-card-icon blue">
              <Users size={18} />
            </div>
            <span className="hub-card-count">{totalCustomers}</span>
          </div>
          <div className="hub-card-title">Customer Accounts</div>
          <div className="hub-card-hint">
            {salesReport?.repeat?.repeatCustomers || 0} repeat purchasing buyers
          </div>
          <div className="hub-card-link">
            <span>Customer Insights</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Action Card 4: Storefront Merchandising */}
        <div
          className="hub-card"
          onClick={() => onNavigateTab("hero")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigateTab("hero");
          }}
        >
          <div className="hub-card-top">
            <div className="hub-card-icon purple">
              <Sparkles size={18} />
            </div>
            <span className="hub-card-count">Live</span>
          </div>
          <div className="hub-card-title">Homepage Slides & Banners</div>
          <div className="hub-card-hint">Visual promotions and carousel sequencing</div>
          <div className="hub-card-link">
            <span>Customize Storefront</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
