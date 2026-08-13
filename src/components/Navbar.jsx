import { useState } from "react";
import { navLinks } from "../data";

export default function Navbar() {
  const [activeNav, setActiveNav] = useState("Electronics");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <div
          className="nav-browse"
          id="browse-categories-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <span>☰</span>
          <span>Browse Categories</span>
        </div>
        <div className="nav-links">
          {navLinks.map((link) => (
            <span
              key={link}
              className={`nav-link ${activeNav === link ? "active" : ""}`}
              onClick={() => setActiveNav(link)}
              id={`nav-${link.toLowerCase().replace(/[^a-z]/g, "-")}`}
            >
              {link}
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}
