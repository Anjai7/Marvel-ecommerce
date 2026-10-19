import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export default function CustomerRepeatChart({ data }) {
  if (!data || data.totalCustomers === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No customers yet</span>
      </div>
    );
  }

  const chartData = [
    { name: "Repeat Customers", value: data.repeatCustomers },
    { name: "One-Time Buyers", value: data.totalCustomers - data.repeatCustomers },
  ];

  return (
    <div className="recharts-wrapper">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Tooltip
              content={({ active, name, value }) => active && `<div>${name}: ${value}</div>`}
            />
            <Pie
              data={chartData}
              cx={110}
              cy={110}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              isAnimationActive={false}
              labelLine={false}
            >
              <Cell key="repeat" fill="#2563eb" />
              <Cell key="one-time" fill="#94a3b8" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-total">{data.repeatRate.toFixed(0)}%</span>
          <span className="donut-label">Repeat Rate</span>
        </div>
      </div>
    </div>
  );
}
