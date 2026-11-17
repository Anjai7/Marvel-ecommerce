import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { LOW_STOCK_THRESHOLD } from "../adminConstants";
import { STOCK_COLORS } from "./chartTheme";
import { formatCurrency } from "../../../lib/currency";

export default function InventoryChart({ data }) {
  if (!data) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No products yet</span>
      </div>
    );
  }

  const healthyStock = Math.max(0, (data.inStock || 0) - (data.lowStock || 0));
  const lowStock = data.lowStock || 0;
  const outOfStock = data.outOfStock || 0;
  const totalItems = healthyStock + lowStock + outOfStock;
  const healthRate = totalItems > 0 ? Math.round((healthyStock / totalItems) * 100) : 100;

  const rawData = [
    { name: "Healthy Stock (>5)", value: healthyStock, color: STOCK_COLORS.inStock },
    {
      name: `Low Stock (1-${LOW_STOCK_THRESHOLD})`,
      value: lowStock,
      color: STOCK_COLORS.lowStock,
    },
    { name: "Out of Stock (0)", value: outOfStock, color: STOCK_COLORS.outOfStock },
  ];

  const chartData = rawData.filter((item) => item.value > 0);
  const displayData =
    chartData.length > 0 ? chartData : [{ name: "No Inventory", value: 1, color: "#cbd5e1" }];

  return (
    <div className="inventory-chart-wrap">
      {data.value > 0 && (
        <div className="inventory-stat-banner">
          <span className="inventory-stat-label">Total Catalog Asset Value:</span>
          <strong className="inventory-stat-val text-emerald">{formatCurrency(data.value)}</strong>
        </div>
      )}

      <div className="inventory-donut-layout">
        <div className="inventory-chart-container">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Tooltip
                formatter={(val, name) => [`${val} products`, name]}
                contentStyle={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Pie
                data={displayData}
                cx={90}
                cy={90}
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
              >
                {displayData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="inventory-donut-center">
            <span className="inventory-donut-pct">{healthRate}%</span>
            <span className="inventory-donut-sub">Healthy</span>
          </div>
        </div>

        <div className="inventory-legend-cards">
          <div className="inventory-legend-card healthy">
            <div className="inventory-legend-dot healthy" />
            <div className="inventory-legend-info">
              <span className="inventory-legend-title">Healthy Stock (&gt;5)</span>
              <strong className="inventory-legend-num">{healthyStock} items</strong>
            </div>
          </div>
          <div className="inventory-legend-card low">
            <div className="inventory-legend-dot low" />
            <div className="inventory-legend-info">
              <span className="inventory-legend-title">Low Stock (1-{LOW_STOCK_THRESHOLD})</span>
              <strong className="inventory-legend-num">{lowStock} items</strong>
            </div>
          </div>
          <div className="inventory-legend-card out">
            <div className="inventory-legend-dot out" />
            <div className="inventory-legend-info">
              <span className="inventory-legend-title">Out of Stock (0)</span>
              <strong className="inventory-legend-num">{outOfStock} items</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
