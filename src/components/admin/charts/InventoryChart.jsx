import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { LOW_STOCK_THRESHOLD } from "../adminConstants";
import { AXIS_TICK, STOCK_COLORS } from "./chartTheme";
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
  const chartData = [
    { name: "Healthy Stock (>5)", value: healthyStock, color: STOCK_COLORS.inStock },
    {
      name: `Low Stock (1-${LOW_STOCK_THRESHOLD})`,
      value: data.lowStock || 0,
      color: STOCK_COLORS.lowStock,
    },
    { name: "Out of Stock (0)", value: data.outOfStock || 0, color: STOCK_COLORS.outOfStock },
  ];

  return (
    <div className="inventory-chart-wrap">
      {data.value > 0 && (
        <div className="inventory-stat-banner">
          <span className="inventory-stat-label">Total Catalog Asset Value:</span>
          <strong className="inventory-stat-val text-emerald">{formatCurrency(data.value)}</strong>
        </div>
      )}
      <div className="recharts-wrapper">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} />
            <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={140} />
            <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip
              formatter={(val) => [`${val} products`, "Catalog Count"]}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
