import React, { useState, useEffect, useCallback } from "react";
import { Clock, Search, X, ArrowRight } from "lucide-react";
import { toAppHref } from "../ui/linkTarget";
import { navigateToPath } from "../../lib/routes";

const RECENT_STORAGE_KEY = "marvel_recent_searches";

export function loadRecentSearches() {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim() !== "").slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearches(searches) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // Storage unavailable
  }
}

export default function RecentSearchesSection({ onNavigate, onSearchSelect }) {
  const [searches, setSearches] = useState([]);

  const refreshSearches = useCallback(() => {
    setSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    refreshSearches();

    const handleStorage = (e) => {
      if (!e || e.key === RECENT_STORAGE_KEY) {
        refreshSearches();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("marvel_recent_searches_updated", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("marvel_recent_searches_updated", handleStorage);
    };
  }, [refreshSearches]);

  const handleChipClick = (term) => {
    if (onSearchSelect) {
      onSearchSelect(term);
    } else if (onNavigate) {
      onNavigate(toAppHref(`/products?search=${encodeURIComponent(term)}`));
    } else if (typeof window !== "undefined") {
      navigateToPath(`/products?search=${encodeURIComponent(term)}`);
    }
  };

  const handleRemove = (e, termToRemove) => {
    e.stopPropagation();
    const updated = searches.filter((item) => item !== termToRemove);
    saveRecentSearches(updated);
    setSearches(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("marvel_recent_searches_updated"));
    }
  };

  const handleClearAll = () => {
    saveRecentSearches([]);
    setSearches([]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("marvel_recent_searches_updated"));
    }
  };

  // If no searches, gracefully handle empty search history
  if (searches.length === 0) {
    return null;
  }

  return (
    <section
      className="section-block section-recent-searches"
      id="recent-searches-section"
      style={{ padding: "32px 0 20px" }}
    >
      <div className="container" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Your Recent Searches
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Jump back to what you were looking for
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                textDecoration: "underline",
              }}
              aria-label="Clear search history"
            >
              Clear all
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            {searches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleChipClick(term)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  color: "#1e293b",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e2e8f0";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
              >
                <Search size={13} color="#64748b" />
                <span>{term}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${term}`}
                  onClick={(e) => handleRemove(e, term)}
                  onKeyDown={(e) => e.key === "Enter" && handleRemove(e, term)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: 2,
                    color: "#94a3b8",
                  }}
                >
                  <X size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
