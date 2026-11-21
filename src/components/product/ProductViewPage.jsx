import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Home, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import ProductImageGallery from "./ProductImageGallery";
import ProductDetails from "./ProductDetails";
import ProductInfoTabs from "./ProductInfoTabs";
import FrequentlyVisited from "./FrequentlyVisited";
import RecentlyViewed, { recordProductView } from "../storefront/RecentlyViewed";
import RelatedProducts from "./RelatedProducts";
import CustomerReviews from "./CustomerReviews";
import { buildDynamicProductDetails } from "./dynamicProductBuilder";
import { apiFetchProductDetails } from "../../api/productDetailsApi";
// Shared product-surface stylesheet (responsive rules, tap targets).

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

  // The rail shows what this browser actually opened, not a featured list.
  useEffect(() => {
    if (state.view?.id) recordProductView(state.view.id);
  }, [state.view?.id]);

  /**
   * A submitted review is already on screen; only the stored summary needs to
   * catch up. This refetches the details without dropping the page back to the
   * loading state, and ignores the result if another product was opened first.
   */
  const refreshReviews = useCallback(async () => {
    if (!resolvedId) return;
    try {
      const payload = await apiFetchProductDetails(resolvedId);
      setState((current) =>
        current.status === "ready" && current.view?.id === resolvedId
          ? { ...current, reviews: payload?.reviews ?? null }
          : current
      );
    } catch {
      // The saved review is still shown; the next visit reloads the list.
    }
  }, [resolvedId]);

  if (state.status === "loading") {
    return (
      <div className="pvp-loading">
        <Loader2 size={36} className="animate-spin" color="#2563eb" />
        <div className="pvp-loading-text">Loading product details…</div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="pvp-error-wrap">
        <div className="pvp-error-card">
          <AlertCircle size={36} color="#ef4444" className="pvp-error-icon" />
          <h3 className="pvp-error-title">Product Unavailable</h3>
          <p className="pvp-error-message">{state.message ?? "No product was requested."}</p>
          <div className="pvp-error-actions">
            {state.status === "error" && resolvedId && (
              <button onClick={load} className="pvp-error-retry">
                <RefreshCw size={15} /> Try Again
              </button>
            )}
            <button onClick={onBack} className="pvp-error-back">
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
              {/* The product's own short copy, straight under the gallery. */}
              {view.description ? <p className="pvp-gallery-desc">{view.description}</p> : null}
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
      <RelatedProducts category={view.category} currentId={view.id} />
      <RecentlyViewed currentId={view.id} />

      {/* ── Customer Reviews ── */}
      <div className="pvp-reviews-section">
        <div className="container">
          <CustomerReviews reviews={reviews} productId={view.id} onReviewAdded={refreshReviews} />
        </div>
      </div>
    </div>
  );
}
