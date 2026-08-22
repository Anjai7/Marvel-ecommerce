import React, { useState, useEffect } from "react";
import { ChevronLeft, Home, Loader2, AlertCircle } from "lucide-react";
import ProductImageGallery from "./ProductImageGallery";
import ProductDetails from "./ProductDetails";
import ProductInfoTabs from "./ProductInfoTabs";
import FrequentlyVisited from "./FrequentlyVisited";
import CustomerReviews from "./CustomerReviews";
import { buildDynamicProductDetails } from "./dynamicProductBuilder";
import { apiFetchProductById, apiFetchProducts } from "../../api/backendApi";

export default function ProductViewPage({ productId, product: initialProduct, onBack, onSelectProduct }) {
  const [productData, setProductData] = useState(() => buildDynamicProductDetails(initialProduct));
  const [loading, setLoading] = useState(!initialProduct || (productId && initialProduct?.id !== productId));
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProduct = async () => {
      // If we already have the matching full product object, use it directly
      if (initialProduct && (!productId || initialProduct.id === productId)) {
        setProductData(buildDynamicProductDetails(initialProduct));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (productId) {
          // Fetch exact product by ID from Supabase DB via backend
          const fetched = await apiFetchProductById(productId);
          if (fetched) {
            setProductData(buildDynamicProductDetails(fetched));
          } else {
            setError(`Product #${productId} could not be found in the database.`);
          }
        } else {
          // Fallback to first available DB product
          const prods = await apiFetchProducts();
          if (prods && prods.length > 0) {
            setProductData(buildDynamicProductDetails(prods[0]));
          } else {
            setError("No products available in the database.");
          }
        }
      } catch (err) {
        console.error("Error loading product:", err);
        setError("Failed to load product details from server.");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId, initialProduct]);

  if (loading) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16
      }}>
        <Loader2 size={36} className="animate-spin" color="#2563eb" />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>
          Loading dynamic product specifications &amp; media from database...
        </div>
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "36px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0"
        }}>
          <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            Product Unavailable
          </h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            {error || "The requested item could not be retrieved."}
          </p>
          <button
            onClick={onBack}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pvp-root" id="product-view-page">
      {/* ── Breadcrumb ── */}
      <div className="pvp-breadcrumb-wrap">
        <div className="container">
          <nav className="pvp-breadcrumb" aria-label="Breadcrumb">
            <button className="pvp-back-btn" onClick={onBack}>
              <ChevronLeft size={16} /> Back
            </button>
            <span className="pvp-bc-sep">/</span>
            <a href="#" className="pvp-bc-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
              <Home size={13} /> Home
            </a>
            <span className="pvp-bc-sep">/</span>
            <span className="pvp-bc-link">{productData.category}</span>
            <span className="pvp-bc-sep">/</span>
            <span className="pvp-bc-current">{productData.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Main Product Section ── */}
      <div className="pvp-main-section">
        <div className="container">
          <div className="pvp-product-grid">
            {/* Left: Image Gallery */}
            <div className="pvp-gallery-col">
              <div className="pvp-gallery-sticky">
                <ProductImageGallery media={productData.media} />
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="pvp-details-col">
              <ProductDetails product={productData} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Tabs Section ── */}
      <div className="pvp-info-section">
        <div className="container">
          <ProductInfoTabs product={productData} />
        </div>
      </div>

      {/* ── Frequently Visited ── */}
      <FrequentlyVisited onView={onSelectProduct} />

      {/* ── Customer Reviews ── */}
      <div className="pvp-reviews-section">
        <div className="container">
          <CustomerReviews product={productData} />
        </div>
      </div>
    </div>
  );
}
