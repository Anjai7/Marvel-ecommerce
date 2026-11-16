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
import { formatCurrency } from "../../../lib/currency";
import { AXIS_TICK } from "./chartTheme";

const SELLER_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#818cf8", "#a78bfa"];

export default function BestSellersChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No products sold yet</span>
      </div>
    );
  }

  const chartData = data.map((d, idx) => ({
    ...d,
    titleShort: d.title.length > 25 ? d.title.slice(0, 23) + "…" : d.title,
    color: SELLER_COLORS[idx % SELLER_COLORS.length],
  }));

  return (
    <div className="recharts-wrapper">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} />
          <YAxis dataKey="titleShort" type="category" tick={AXIS_TICK} width={155} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={(v) => formatCurrency(v, { decimals: 0 })}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            formatter={(value, name, props) => [
              `${formatCurrency(value)} (${props?.payload?.qty || 1} units sold)`,
              props?.payload?.title || "Revenue",
            ]}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`seller-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
