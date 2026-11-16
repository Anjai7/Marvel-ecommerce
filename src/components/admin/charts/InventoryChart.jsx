import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { LOW_STOCK_THRESHOLD } from "../adminConstants";

export default function InventoryChart({ data }) {
  if (!data) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No products yet</span>
      </div>
    );
  }

  const chartData = [
    { name: "In Stock", value: data.inStock, color: "#10b981" },
    {
      name: `Low Stock (${LOW_STOCK_THRESHOLD} or fewer)`,
      value: data.lowStock,
      color: "#f59e0b",
    },
    { name: "Out of Stock", value: data.outOfStock, color: "#ef4444" },
  ];

  return (
    <div className="recharts-wrapper">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} />
          <YAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={150} />
          <XAxis tick={{ fontSize: 11, fill: "#64748b" }} hide />
          <Tooltip />
          {chartData.map((entry) => (
            <Bar key={entry.name} dataKey="value" fill={entry.color} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
