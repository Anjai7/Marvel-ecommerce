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

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  completed: "#059669",
  cancelled: "#ef4444",
};

export default function OrderStatusChart({ data }) {
  if (!data || Object.values(data).every((v) => v === 0)) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No orders yet</span>
      </div>
    );
  }

  const labels = {
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: labels[k] || k, value: v, color: STATUS_COLORS[k] }));

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
