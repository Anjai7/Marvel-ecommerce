import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { roleColor, roleLabel } from "./roleColors";

export default function UserRolesChart({ data }) {
  const total = Array.isArray(data) ? data.reduce((sum, d) => sum + d.value, 0) : 0;
  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-text">No users yet</span>
      </div>
    );
  }

  return (
    <div className="recharts-wrapper">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const slice = payload[0];
                const value = Number(slice.value) || 0;
                return (
                  <div>
                    {roleLabel(slice.payload?.name)}: {value} ({((value / total) * 100).toFixed(0)}
                    %)
                  </div>
                );
              }}
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
                <Cell key={`cell-${idx}`} fill={roleColor(entry.name)} />
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
