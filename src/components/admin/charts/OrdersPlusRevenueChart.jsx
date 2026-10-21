import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "../../../lib/currency";

export default function OrdersPlusRevenueChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No orders yet</span>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, orders: d.ordersCount }));

  return (
    <div className="recharts-wrapper">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickMargin={8} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip
            formatter={(value, name) => (name === "revenue" ? formatCurrency(value) : value)}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Line dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
