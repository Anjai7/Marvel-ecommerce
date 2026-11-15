import React, { useState, useEffect, useCallback } from "react";
import { Clock, Search, X } from "lucide-react";
import { toAppHref } from "../ui/linkTarget";
import { navigateToPath } from "../../lib/routes";
import "./widgets.css";

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
      className="section-block section-recent-searches recent-searches-section"
      id="recent-searches-section"
    >
      <div className="container recent-searches-container">
        <div className="recent-searches-card">
          <div className="recent-searches-head">
            <div className="recent-searches-title-group">
              <div className="recent-searches-icon-badge">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="recent-searches-title">Your Recent Searches</h3>
                <span className="recent-searches-subtitle">
                  Jump back to what you were looking for
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              className="recent-searches-clear"
              aria-label="Clear search history"
            >
              Clear all
            </button>
          </div>

          <div className="recent-searches-chips">
            {searches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleChipClick(term)}
                className="recent-search-chip"
              >
                <Search size={13} color="#64748b" />
                <span>{term}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${term}`}
                  onClick={(e) => handleRemove(e, term)}
                  onKeyDown={(e) => e.key === "Enter" && handleRemove(e, term)}
                  className="recent-search-chip-remove"
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
