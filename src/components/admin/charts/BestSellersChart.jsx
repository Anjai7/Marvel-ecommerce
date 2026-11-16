import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatCurrency } from "../../../lib/currency";

export default function BestSellersChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No products sold yet</span>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    titleShort: d.title.length > 20 ? d.title.slice(0, 17) + "..." : d.title,
  }));

  return (
    <div className="recharts-wrapper">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} />
          <YAxis dataKey="titleShort" tick={{ fontSize: 11, fill: "#64748b" }} width={140} />
          <XAxis tick={{ fontSize: 11, fill: "#64748b" }} hide />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value) => formatCurrency(value)}
          />
          <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
