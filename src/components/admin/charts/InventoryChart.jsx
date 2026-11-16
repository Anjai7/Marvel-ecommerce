import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { LOW_STOCK_THRESHOLD } from "../adminConstants";
import { AXIS_TICK, STOCK_COLORS } from "./chartTheme";

export default function InventoryChart({ data }) {
  if (!data) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No products yet</span>
      </div>
    );
  }

  const chartData = [
    { name: "In Stock", value: data.inStock, color: STOCK_COLORS.inStock },
    {
      name: `Low Stock (${LOW_STOCK_THRESHOLD} or fewer)`,
      value: data.lowStock,
      color: STOCK_COLORS.lowStock,
    },
    { name: "Out of Stock", value: data.outOfStock, color: STOCK_COLORS.outOfStock },
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
          <YAxis dataKey="name" tick={AXIS_TICK} width={150} />
          <XAxis tick={AXIS_TICK} hide />
          <Tooltip />
          {chartData.map((entry) => (
            <Bar key={entry.name} dataKey="value" fill={entry.color} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
