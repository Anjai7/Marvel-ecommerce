import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "../adminConstants";

/* Keyed by the `order_status` enum value, so every slice is a stage the
 * database can actually store. */
const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

export default function OrderStatusChart({ data }) {
  const chartData = ORDER_STATUSES.map((status) => ({
    name: ORDER_STATUS_LABELS[status],
    value: Number(data?.[status]) || 0,
    color: STATUS_COLORS[status],
  }));

  if (!data || !chartData.some((entry) => entry.value > 0)) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No orders yet</span>
      </div>
    );
  }

  return (
    <div className="recharts-wrapper">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickMargin={8} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} hide />
          <Tooltip />
          <Legend verticalAlign="top" height={36} />
          {chartData.map((entry) => (
            <Bar key={entry.name} dataKey="value" fill={entry.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
