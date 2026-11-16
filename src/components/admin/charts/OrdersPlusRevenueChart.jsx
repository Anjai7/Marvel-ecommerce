import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "../../../lib/currency";
import { AXIS_TICK } from "./chartTheme";

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
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickMargin={8} />
          <YAxis yAxisId="left" tick={AXIS_TICK} allowDecimals={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            tickFormatter={(v) => formatCurrency(v, { decimals: 0 })}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "Revenue" ? formatCurrency(value) : `${value} orders`
            }
          />
          <Legend verticalAlign="top" height={36} />
          <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            dataKey="revenue"
            name="Revenue"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, fill: "#10b981" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
