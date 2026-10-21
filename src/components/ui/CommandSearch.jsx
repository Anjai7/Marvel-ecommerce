import React, { useState, useEffect, useRef } from "react";
import { Search, Clock, TrendingUp, ChevronRight, X, Sparkles } from "lucide-react";
import { ProductPrice } from "./ProductPrice";
import { apiFetchProducts } from "../../api/backendApi";
import { useContent } from "../../context/ContentContext";

const RECENT_STORAGE_KEY = "marvel_recent_searches";
const MAX_RECENT = 5;
const MAX_CATEGORIES = 6;

/** The visitor's own recent searches; a fresh browser starts with none. */
function loadRecentSearches() {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim() !== "").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(searches) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // storage unavailable — the panel still works for this session
  }
}

export function CommandSearch({ searchQuery, setSearchQuery, onSelectProduct }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recent, setRecent] = useState(loadRecentSearches);
  const [allProducts, setAllProducts] = useState([]);
  const containerRef = useRef(null);

  let content = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- unconditional call; try/catch only guards a missing ContentProvider in isolated tests
    content = useContent();
  } catch {
    content = null;
  }

  // The popular category list is the real category table, not a copy of it.
  const categorySource =
    Array.isArray(content?.categories) && content.categories.length > 0
      ? content.categories.map((category) => category?.name)
      : Array.isArray(content?.categoryTree)
        ? content.categoryTree.map((category) => category?.name)
        : [];
  const categories = Array.from(
    new Set(
      categorySource
        .filter((name) => typeof name === "string" && name.trim() !== "")
        .map((n) => n.trim())
    )
  ).slice(0, MAX_CATEGORIES);

  useEffect(() => {
    const fetchLiveProducts = async () => {
      try {
        const liveProds = await apiFetchProducts();
        if (liveProds && Array.isArray(liveProds)) {
          setAllProducts(liveProds);
        }
      } catch (err) {
        console.error("Error loading products for search:", err);
      }
    };
    fetchLiveProducts();
  }, []);

  useEffect(() => {
    saveRecentSearches(recent);
  }, [recent]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = searchQuery.trim()
    ? allProducts
        .filter(
          (p) =>
            (p.title || p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description || p.category || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  /** Record the visitor's own search, newest first, without duplicates. */
  const rememberSearch = (term) => {
    const value = String(term || "").trim();
    if (!value) return;
    setRecent((previous) =>
      [value, ...previous.filter((item) => item !== value)].slice(0, MAX_RECENT)
    );
  };

  const handleSelectRecent = (term) => {
    setSearchQuery(term);
    rememberSearch(term);
    setIsOpen(true);
  };

  const removeRecent = (e, term) => {
    e.stopPropagation();
    setRecent(recent.filter((item) => item !== term));
  };

  return (
    <div
      className="search-wrap-command"
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
    >
      <div className="search-wrap">
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <input
            id="main-search-input"
            className="search-input"
            type="text"
            placeholder="Search for products, brands and more..."
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rememberSearch(searchQuery);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button className="search-btn" id="search-submit-btn" aria-label="Search">
          <Search size={18} />
        </button>
      </div>

      {/* Popover Command Panel */}
      {isOpen && (
        <div className="search-popover-panel">
          {/* Recent Searches (localStorage, per browser) */}
          {recent.length > 0 && !searchQuery && (
            <div className="search-section">
              <div className="search-section-title">
                <Clock size={14} /> Recent Searches
              </div>
              <div className="search-chips">
                {recent.map((item) => (
                  <div key={item} className="search-chip" onClick={() => handleSelectRecent(item)}>
                    <span>{item}</span>
                    <button
                      className="search-chip-remove"
                      onClick={(e) => removeRecent(e, item)}
                      aria-label="Remove search"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Popular Categories (the live category table) */}
          {!searchQuery && categories.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">
                <TrendingUp size={14} /> Popular Categories
              </div>
              <div className="search-categories-grid">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="search-category-item"
                    onClick={() => {
                      setSearchQuery(cat);
                      rememberSearch(cat);
                      setIsOpen(true);
                    }}
                  >
                    <span>{cat}</span>
                    <ChevronRight size={14} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matching Products */}
          {searchQuery && (
            <div className="search-section">
              <div className="search-section-title">
                <Sparkles size={14} /> Matching Products ({filteredProducts.length})
              </div>
              {filteredProducts.length > 0 ? (
                <div className="search-products-list">
                  {filteredProducts.map((product) => {
                    const img = product.image_url || product.image || "";
                    const title = product.title || product.name;
                    return (
                      <div
                        key={product.id}
                        className="search-product-row"
                        onClick={() => {
                          rememberSearch(searchQuery);
                          if (onSelectProduct) onSelectProduct(product);
                          setIsOpen(false);
                        }}
                      >
                        {img && <img src={img} alt={title} className="search-product-img" />}
                        <div className="search-product-info">
                          <div className="search-product-name">{title}</div>
                          <ProductPrice
                            price={product.price}
                            originalPrice={product.original_price || product.originalPrice}
                            size="sm"
                          />
                        </div>
                        <ChevronRight size={16} color="var(--gray-400)" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="search-no-results">No live products found for "{searchQuery}"</div>
              )}
            </div>
          )}

          <div className="search-popover-footer">
            <span>Press Enter to search live catalog</span>
            <span className="search-view-all-link">Showing dynamic Supabase results</span>
          </div>
        </div>
      )}
    </div>
  );
}
