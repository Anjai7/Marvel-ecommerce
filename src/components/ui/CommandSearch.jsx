import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Clock, TrendingUp, ChevronRight, X, Sparkles, Grid } from "lucide-react";
import { ProductPrice } from "./ProductPrice";
import { apiFetchCategoryProducts } from "../../api/backendApi";
import { navigateToPath } from "../../lib/routes";
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
  // The matches for the term the visitor is typing, asked of the server —
  // the whole catalogue is a thousand rows and the panel shows five.
  const [matches, setMatches] = useState([]);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  let content = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- unconditional call; try/catch only guards a missing ContentProvider in isolated tests
    content = useContent();
  } catch {
    content = null;
  }

  // The popular category list is the real category table, not a copy of it.
  const categorySource = useMemo(() => {
    return Array.isArray(content?.categories) && content.categories.length > 0
      ? content.categories.map((category) => category?.name)
      : Array.isArray(content?.categoryTree)
        ? content.categoryTree.map((category) => category?.name)
        : [];
  }, [content?.categories, content?.categoryTree]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        categorySource
          .filter((name) => typeof name === "string" && name.trim() !== "")
          .map((n) => n.trim())
      )
    ).slice(0, MAX_CATEGORIES);
  }, [categorySource]);

  // The panel shows the top five matches for the term. Searching the whole
  // catalogue in the browser would mean downloading it on every page, so the
  // server answers instead — a few kilobytes, and the catalogue is only
  // downloaded when there is a term to search for.
  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setMatches([]);
      return undefined;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetchCategoryProducts({
          scope: "all",
          search: term,
          pageSize: 5,
          sort: "featured",
        });
        setMatches(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setMatches([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

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

  const filteredProducts = matches;

  const matchingCategories = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return [];
    return Array.from(
      new Set(
        categorySource.filter(
          (name) => typeof name === "string" && name.toLowerCase().includes(term)
        )
      )
    ).slice(0, 4);
  }, [searchQuery, categorySource]);

  /** Record the visitor's own search, newest first, without duplicates. */
  const rememberSearch = (term) => {
    const value = String(term || "").trim();
    if (!value) return;
    setRecent((previous) =>
      [value, ...previous.filter((item) => item !== value)].slice(0, MAX_RECENT)
    );
  };

  const executeSearch = (rawTerm) => {
    const term = String(rawTerm !== undefined ? rawTerm : searchQuery).trim();
    if (!term) return;
    rememberSearch(term);
    setIsOpen(false);
    navigateToPath(`/products?search=${encodeURIComponent(term)}`);
  };

  const handleSelectRecent = (term) => {
    setSearchQuery(term);
    executeSearch(term);
  };

  const removeRecent = (e, term) => {
    e.stopPropagation();
    setRecent(recent.filter((item) => item !== term));
  };

  return (
    <div className="search-wrap-command" ref={containerRef}>
      <div className="search-wrap">
        <div className="search-field">
          <input
            id="main-search-input"
            className="search-input"
            type="text"
            placeholder="Search for products, brands and more..."
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                executeSearch();
              }
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

        <button
          className="search-btn"
          id="search-submit-btn"
          aria-label="Search"
          type="button"
          onClick={() => executeSearch()}
        >
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
                  <div
                    key={item}
                    className="search-chip"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectRecent(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectRecent(item);
                      }
                    }}
                  >
                    <span>{item}</span>
                    <button
                      type="button"
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
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSearchQuery(cat);
                      executeSearch(cat);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSearchQuery(cat);
                        executeSearch(cat);
                      }
                    }}
                  >
                    <span>{cat}</span>
                    <ChevronRight size={14} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matching Categories */}
          {searchQuery && matchingCategories.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">
                <Grid size={14} /> Matching Categories ({matchingCategories.length})
              </div>
              <div className="search-categories-grid">
                {matchingCategories.map((cat) => (
                  <div
                    key={cat}
                    className="search-category-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSearchQuery(cat);
                      executeSearch(cat);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSearchQuery(cat);
                        executeSearch(cat);
                      }
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
                          {product.sku && (
                            <div className="search-product-meta">Code: {product.sku}</div>
                          )}
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
