import React from "react";
import { ChevronLeft, Home } from "lucide-react";
import { productDetailData } from "../../data";
import ProductImageGallery from "./ProductImageGallery";
import ProductDetails from "./ProductDetails";
import ProductInfoTabs from "./ProductInfoTabs";
import FrequentlyVisited from "./FrequentlyVisited";
import CustomerReviews from "./CustomerReviews";

export default function ProductViewPage({ onBack, onSelectProduct }) {
  const product = productDetailData;

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
            <a href="#" className="pvp-bc-link" onClick={onBack}><Home size={13} /> Home</a>
            <span className="pvp-bc-sep">/</span>
            <a href="#" className="pvp-bc-link">Electronics</a>
            <span className="pvp-bc-sep">/</span>
            <a href="#" className="pvp-bc-link">Headphones</a>
            <span className="pvp-bc-sep">/</span>
            <span className="pvp-bc-current">{product.name}</span>
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
                <ProductImageGallery media={product.media} />
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="pvp-details-col">
              <ProductDetails product={product} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Tabs Section ── */}
      <div className="pvp-info-section">
        <div className="container">
          <ProductInfoTabs product={product} />
        </div>
      </div>

      {/* ── Frequently Visited ── */}
      <FrequentlyVisited onView={onSelectProduct} />

      {/* ── Customer Reviews ── */}
      <div className="pvp-reviews-section">
        <div className="container">
          <CustomerReviews product={product} />
        </div>
      </div>
    </div>
  );
}
