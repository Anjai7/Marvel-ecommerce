import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button, Input } from "../ui";
import { apiFetchProducts } from "../../api/backendApi";

export default function ProductPicker({ value = [], onChange, disabled = false, max = 24, id }) {
  const selectedIds = Array.isArray(value) ? value : [];
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      setError(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const products = await apiFetchProducts({ search: trimmed });
        setResults(Array.isArray(products) ? products : []);
        setHasSearched(true);
      } catch (err) {
        setError(err?.message || "Failed to search products.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  const handleAdd = (product) => {
    if (disabled || selectedIds.includes(product.id) || selectedIds.length >= max) return;
    onChange?.([...selectedIds, product.id]);
  };

  const handleRemove = (productId) => {
    if (disabled) return;
    onChange?.(selectedIds.filter((item) => item !== productId));
  };

  return (
    <div className="product-picker" style={{ display: "grid", gap: 12 }}>
      {selectedIds.length > 0 && (
        <div
          className="product-picker-selected"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {selectedIds.map((selectedId) => (
            <div
              key={selectedId}
              className="product-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                background: "#f1f5f9",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              <span style={{ fontFamily: "monospace" }}>{selectedId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove product ${selectedId}`}
                style={{ width: 18, height: 18, padding: 0 }}
                onClick={() => handleRemove(selectedId)}
              >
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Input
          id={id}
          type="text"
          value={searchTerm}
          placeholder="Search products by title..."
          disabled={disabled}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search products"
        />
      </div>

      {loading && <p className="text-sm text-muted">Searching products...</p>}

      {error && (
        <p role="alert" className="form-error text-sm">
          {error}
        </p>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <p role="status" className="text-sm text-muted">
          No products found for &quot;{searchTerm.trim()}&quot;.
        </p>
      )}

      {!loading && results.length > 0 && (
        <ul
          className="product-picker-results"
          style={{
            margin: 0,
            listStyle: "none",
            display: "grid",
            gap: 6,
            maxHeight: 240,
            overflowY: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            background: "#ffffff",
            padding: 6,
          }}
        >
          {results.map((product) => {
            const isSelected = selectedIds.includes(product.id);
            return (
              <li
                key={product.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: "#334155",
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {product.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-color, #94a3b8)" }}>
                      ₹{product.price}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isSelected ? "outline" : "default"}
                  size="sm"
                  disabled={disabled || isSelected || selectedIds.length >= max}
                  onClick={() => handleAdd(product)}
                  aria-label={isSelected ? `Selected ${product.title}` : `Add ${product.title}`}
                >
                  {isSelected ? "Selected" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
