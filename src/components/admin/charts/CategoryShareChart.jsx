import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency } from "../../../lib/currency";

export default function CategoryShareChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No category sales data yet</span>
      </div>
    );
  }

  const grandTotal = data.reduce((sum, d) => sum + (d.revenue || 0), 0);

  return (
    <div className="category-share-layout">
      <div className="category-donut-wrap">
        <ResponsiveContainer width={190} height={190}>
          <PieChart>
            <Tooltip
              formatter={(val, name, props) => [
                `${formatCurrency(val)} (${props?.payload?.percentage?.toFixed(1) || 0}%)`,
                props?.payload?.name || name,
              ]}
            />
            <Pie
              data={data}
              cx={95}
              cy={95}
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="category-donut-center">
          <span className="donut-total">{data.length}</span>
          <span className="donut-label">Categories</span>
        </div>
      </div>

      <div className="category-share-legend">
        {data.map((cat) => (
          <div key={cat.name} className="category-legend-item">
            <svg width="10" height="10" className="category-legend-dot-svg" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill={cat.color} />
            </svg>
            <span className="category-legend-name">{cat.name}</span>
            <span className="category-legend-pct">{cat.percentage.toFixed(1)}%</span>
            <span className="category-legend-amount">
              {formatCurrency(cat.revenue, { decimals: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
