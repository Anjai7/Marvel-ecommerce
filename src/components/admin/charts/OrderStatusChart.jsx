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
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "../adminConstants";
import { AXIS_TICK } from "./chartTheme";

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

export default function OrderStatusChart({ data, onSelectStatus }) {
  const chartData = ORDER_STATUSES.map((status) => ({
    name: ORDER_STATUS_LABELS[status] || status,
    statusKey: status,
    value: Number(data?.[status]) || 0,
    color: STATUS_COLORS[status] || "#64748b",
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (!data || total === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No orders yet</span>
      </div>
    );
  }

  const deliveredCount = data?.delivered || 0;
  const fulfillmentRate = total > 0 ? ((deliveredCount / total) * 100).toFixed(1) : 0;

  return (
    <div className="pipeline-chart-wrap">
      <div className="pipeline-stat-banner">
        <span className="pipeline-stat-label">Fulfillment Rate:</span>
        <strong className="pipeline-stat-val text-emerald">{fulfillmentRate}% Delivered</strong>
        <span className="pipeline-stat-sub">
          ({deliveredCount} of {total} orders)
        </span>
      </div>
      <div className="recharts-wrapper">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} tickMargin={8} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip
              formatter={(val, name, props) => [
                `${val} orders (${((val / total) * 100).toFixed(1)}%)`,
                props?.payload?.name || name,
              ]}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              onClick={(entry) => {
                if (entry?.statusKey && onSelectStatus) {
                  onSelectStatus(entry.statusKey);
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  cursor={onSelectStatus ? "pointer" : "default"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
