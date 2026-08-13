import { sidebarCategories } from "../data";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {sidebarCategories.map((cat, i) => (
        <div
          key={i}
          className="sidebar-item"
          id={`sidebar-${cat.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
        >
          <div className="sidebar-item-inner">
            <span className="sidebar-icon">{cat.icon}</span>
            <span>{cat.label}</span>
          </div>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>›</span>
        </div>
      ))}
      <div className="sidebar-divider" />
      <div className="sidebar-view-all" id="sidebar-view-all">
        <span>📋</span>
        <span>View All Categories</span>
      </div>
    </aside>
  );
}
