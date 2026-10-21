import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Home, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import ProductImageGallery from "./ProductImageGallery";
import ProductDetails from "./ProductDetails";
import ProductInfoTabs from "./ProductInfoTabs";
import FrequentlyVisited from "./FrequentlyVisited";
import CustomerReviews from "./CustomerReviews";
import { buildDynamicProductDetails } from "./dynamicProductBuilder";
import { apiFetchProductDetails } from "../../api/productDetailsApi";

/**
 * The product page.
 *
 * Every value on screen comes from `GET /api/products/:id/details`. A failed
 * request renders an explicit error and a retry — never a plausible-looking
 * product built from defaults.
 */
export default function ProductViewPage({
  productId,
  product: initialProduct,
  onBack,
  onSelectProduct,
}) {
  const resolvedId = productId || initialProduct?.id || null;
  const [state, setState] = useState(() =>
    resolvedId ? { status: "loading" } : { status: "missing" }
  );

  const load = useCallback(async () => {
    if (!resolvedId) {
      setState({ status: "missing" });
      return;
    }

    setState({ status: "loading" });
    try {
      const payload = await apiFetchProductDetails(resolvedId);
      const view = buildDynamicProductDetails(payload);
      if (!view) {
        setState({
          status: "error",
          message: "This product could not be found.",
        });
        return;
      }
      setState({ status: "ready", view, reviews: payload?.reviews ?? null });
    } catch (error) {
      const message =
        error?.status === 404
          ? "This product is no longer available."
          : "We could not load this product. Please try again.";
      setState({ status: "error", message });
    }
  }, [resolvedId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div
        style={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <Loader2 size={36} className="animate-spin" color="#2563eb" />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>
          Loading product details…
        </div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div
        style={{
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "36px 32px",
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            Product Unavailable
          </h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            {state.message ?? "No product was requested."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {state.status === "error" && resolvedId && (
              <button
                onClick={load}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={15} /> Try Again
              </button>
            )}
            <button
              onClick={onBack}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { view, reviews } = state;

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
            <a
              href="#"
              className="pvp-bc-link"
              onClick={(e) => {
                e.preventDefault();
                onBack();
              }}
            >
              <Home size={13} /> Home
            </a>
            {view.category && (
              <>
                <span className="pvp-bc-sep">/</span>
                <span className="pvp-bc-link">{view.category}</span>
              </>
            )}
            {view.name && (
              <>
                <span className="pvp-bc-sep">/</span>
                <span className="pvp-bc-current">{view.name}</span>
              </>
            )}
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
                <ProductImageGallery media={view.media} />
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="pvp-details-col">
              <ProductDetails product={view} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Tabs Section ── */}
      <div className="pvp-info-section">
        <div className="container">
          <ProductInfoTabs product={view} />
        </div>
      </div>

      {/* ── More products ── */}
      <FrequentlyVisited onView={onSelectProduct} excludeId={view.id} />

      {/* ── Customer Reviews ── */}
      <div className="pvp-reviews-section">
        <div className="container">
          <CustomerReviews reviews={reviews} />
        </div>
      </div>
    </div>
  );
}
