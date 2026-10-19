export default function SalesGrowthCard({ data }) {
  const percent = data?.percent;
  const current = data?.current ?? 0;
  const previous = data?.previous ?? 0;
  const isPositive = percent === null ? false : percent >= 0;

  return (
    <div className="kpi-metric-card growth-card">
      <div className="kpi-card-header">
        <span className="kpi-label">Revenue Growth</span>
        <div className="kpi-icon-bubble emerald">
          <span className="growth-icon">{isPositive ? "▲" : "▼"}</span>
        </div>
      </div>
      <div className="kpi-value-row">
        <span className="kpi-number">{percent === null ? "—" : percent.toFixed(1)}%</span>
      </div>
      <div className="kpi-footer-row">
        <span className="kpi-subtext">Current: ${current.toFixed(2)}</span>
        <span className="kpi-subtext">Previous: ${previous.toFixed(2)}</span>
      </div>
    </div>
  );
}
