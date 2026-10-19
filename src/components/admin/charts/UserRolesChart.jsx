import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const ROLE_COLORS = {
  super_admin: "#a855f7",
  admin: "#3b82f6",
  vendor: "#ec4899",
  user: "#2563eb",
};

export default function UserRolesChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No users yet</span>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="recharts-wrapper">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Tooltip
              content={({ active, name, value }) =>
                active && `<div>${name}: ${value} (${((value / total) * 100).toFixed(0)}%)</div>`
              }
            />
            <Pie
              data={data}
              cx={110}
              cy={110}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              isAnimationActive={false}
              labelLine={false}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={ROLE_COLORS[entry.name] || "#64748b"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-total">{total}</span>
          <span className="donut-label">Users</span>
        </div>
      </div>
    </div>
  );
}
