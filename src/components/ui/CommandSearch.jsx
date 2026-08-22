import React, { useState, useEffect, useRef } from "react";
import { Search, Clock, TrendingUp, ChevronRight, X, Sparkles } from "lucide-react";
import { ProductPrice } from "./ProductPrice";
import { apiFetchProducts } from "../../api/backendApi";

const RECENT_SEARCHES = ["Headphones", "Smartwatch", "Keyboard", "Power Bank"];
const POPULAR_CATEGORIES = ["Electronics", "Audio", "Wearables", "Accessories", "Smart Home"];

export function CommandSearch({ searchQuery, setSearchQuery, onSelectProduct }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recent, setRecent] = useState(RECENT_SEARCHES);
  const [allProducts, setAllProducts] = useState([]);
  const containerRef = useRef(null);

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
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter(
        (p) =>
          (p.title || p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.description || p.category || "").toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSelectRecent = (term) => {
    setSearchQuery(term);
    setIsOpen(true);
  };

  const removeRecent = (e, term) => {
    e.stopPropagation();
    setRecent(recent.filter((item) => item !== term));
  };

  return (
    <div className="search-wrap-command" ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div className="search-wrap">
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <input
            id="main-search-input"
            className="search-input"
            type="text"
            placeholder="Search for products, brands and more..."
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
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
          {/* Recent Searches */}
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
                    onClick={() => handleSelectRecent(item)}
                  >
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

          {/* Popular Categories */}
          {!searchQuery && (
            <div className="search-section">
              <div className="search-section-title">
                <TrendingUp size={14} /> Popular Categories
              </div>
              <div className="search-categories-grid">
                {POPULAR_CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="search-category-item"
                    onClick={() => {
                      setSearchQuery(cat);
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
                    const img = product.image_url || product.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120";
                    const title = product.title || product.name;
                    return (
                      <div
                        key={product.id}
                        className="search-product-row"
                        onClick={() => {
                          if (onSelectProduct) onSelectProduct(product);
                          setIsOpen(false);
                        }}
                      >
                        <img src={img} alt={title} className="search-product-img" />
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
