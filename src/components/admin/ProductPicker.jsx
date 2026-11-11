import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui";
import SearchInput from "../ui/SearchInput";
import { apiFetchProducts } from "../../api/backendApi";
import "./admin-forms.css";

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
    <div className="product-picker">
      {selectedIds.length > 0 && (
        <div className="product-picker-selected">
          {selectedIds.map((selectedId) => (
            <div key={selectedId} className="product-chip">
              <span className="product-chip-id">{selectedId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove product ${selectedId}`}
                className="product-chip-remove"
                onClick={() => handleRemove(selectedId)}
              >
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <SearchInput
          fluid
          id={id}
          value={searchTerm}
          onValueChange={setSearchTerm}
          placeholder="Search products by title..."
          ariaLabel="Search products"
          clearLabel="Clear product search"
          disabled={disabled}
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
        <div className="product-picker-results">
          <div className="table-responsive-wrapper">
            <Table className="ui-table--cards">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Product</TableHead>
                  <TableHead scope="col" className="text-right">
                    Price
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="product-picker-result-main">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.title}
                              className="product-picker-thumb"
                            />
                          ) : (
                            <div className="product-picker-thumb-placeholder" />
                          )}
                          <div className="product-picker-result-title">{product.title}</div>
                        </div>
                      </TableCell>
                      <TableCell
                        data-label="Price"
                        className="product-picker-result-price text-right"
                      >
                        ₹{product.price}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant={isSelected ? "outline" : "default"}
                          size="sm"
                          disabled={disabled || isSelected || selectedIds.length >= max}
                          onClick={() => handleAdd(product)}
                          aria-label={
                            isSelected ? `Selected ${product.title}` : `Add ${product.title}`
                          }
                        >
                          {isSelected ? "Selected" : "Add"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
