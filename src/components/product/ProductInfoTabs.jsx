import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Info, Package, MessageSquare, Ruler, Zap, Droplets,
  BookOpen, MoreHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Tag, CreditCard, Download, ExternalLink, Star, Copy, Check, ShieldCheck
} from "lucide-react";
import { useToast } from "../ui";

const TABS = [
  { key: "offers",       label: "Price & Offers",       icon: Tag },
  { key: "info",         label: "Product Information",  icon: Info },
  { key: "details",      label: "Item Details",         icon: Package },
  { key: "feedback",     label: "Feedback & Price Match", icon: MessageSquare },
  { key: "measurements", label: "Measurements",         icon: Ruler },
  { key: "specs",        label: "Features & Specs",     icon: Zap },
  { key: "materials",    label: "Materials & Care",     icon: Droplets },
  { key: "guide",        label: "User Guide",           icon: BookOpen },
  { key: "additional",   label: "Additional Details",   icon: MoreHorizontal },
];

function Collapsible({ label, icon: Icon, open, onToggle, children }) {
  return (
    <div className={`pit-collapse ${open ? "open" : ""}`}>
      <button className="pit-collapse-hd" onClick={onToggle}>
        <span className="pit-collapse-label">
          <Icon size={18} />
          {label}
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div className="pit-collapse-body">{children}</div>}
    </div>
  );
}

function RatingBar({ percent, stars }) {
  return (
    <div className="pit-rbar-row">
      <span className="pit-rbar-stars">{stars} <Star size={12} fill="#f59e0b" color="#f59e0b" /></span>
      <div className="pit-rbar-track">
        <div className="pit-rbar-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="pit-rbar-pct">{percent}%</span>
    </div>
  );
}

export default function ProductInfoTabs({ product }) {
  const [activeTab, setActiveTab]       = useState("offers");
  const [openCollapse, setOpenCollapse] = useState("offers");
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [hoverRating, setHoverRating]   = useState(0);
  const [copiedCode, setCopiedCode]     = useState(null);
  const { addToast } = useToast();

  // Carousel navigation state
  const tabsTrackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollArrows = useCallback(() => {
    const el = tabsTrackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScrollArrows();
    const el = tabsTrackRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScrollArrows, { passive: true });
    window.addEventListener("resize", checkScrollArrows);

    return () => {
      el.removeEventListener("scroll", checkScrollArrows);
      window.removeEventListener("resize", checkScrollArrows);
    };
  }, [checkScrollArrows]);

  const handleScrollBy = (direction) => {
    const el = tabsTrackRef.current;
    if (!el) return;
    const delta = direction === "left" ? -240 : 240;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handleTabClick = (key, e) => {
    setActiveTab(key);
    if (e?.currentTarget) {
      e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  if (!product) return null;

  const {
    offerDetails = { emiOptions: [], bankOffers: [], couponOffers: [] },
    specifications = [],
    dimensions = {},
    materials = [],
    careInstructions = [],
    manufacturer = {},
    userGuide = { steps: [] },
    additionalDetails = { inBox: [], certifications: [] },
    reviewSummary = { breakdown: [] }
  } = product;

  const copyCoupon = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    addToast({
      title: "Coupon Copied!",
      message: `Code ${code} copied to clipboard. Apply at checkout.`,
      type: "success"
    });
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    setFeedbackStep(2);
    addToast({
      title: "Feedback Submitted",
      message: "Thank you for reporting this price! We'll review it shortly.",
      type: "success"
    });
  };

  // ── Tab Panel Content Dictionary ──────────────────────────────
  const content = {
    offers: (
      <div className="pit-offers-content">
        <div className="pit-section-title"><CreditCard size={17} color="var(--navy)" /> No Cost EMI Plans</div>
        <div className="pit-emi-grid">
          {offerDetails.emiOptions?.map(opt => (
            <div className="pit-emi-card" key={opt.months}>
              <div className="pit-emi-months">{opt.months} Months</div>
              <div className="pit-emi-amount">₹{opt.emi.toLocaleString("en-IN")}<span>/mo</span></div>
              <div className={`pit-emi-interest ${opt.interest === "No Cost" ? "free" : ""}`}>{opt.interest}</div>
            </div>
          ))}
        </div>

        <div className="pit-section-title" style={{ marginTop: 24 }}>💳 Partner Bank Offers</div>
        <div className="pit-bank-list">
          {offerDetails.bankOffers?.map((o, i) => (
            <div className="pit-bank-row" key={i}>
              <div className="pit-bank-icon">{o.bank.charAt(0)}</div>
              <div className="pit-bank-details">
                <div className="pit-bank-name">{o.bank}</div>
                <div className="pit-bank-desc">{o.offer}</div>
                {o.code && (
                  <button className="pit-code-pill" onClick={() => copyCoupon(o.code)}>
                    {copiedCode === o.code ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Code: {o.code}</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pit-section-title" style={{ marginTop: 24 }}>🏷️ Exclusive Promo Codes</div>
        <div className="pit-coupon-grid">
          {offerDetails.couponOffers?.map((o, i) => (
            <div className="pit-coupon-card" key={i}>
              <div className="pit-coupon-top">
                <span className="pit-coupon-code">{o.code}</span>
                <button className="pit-coupon-copy-btn" onClick={() => copyCoupon(o.code)}>
                  {copiedCode === o.code ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="pit-coupon-desc">{o.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),

    info: (
      <div className="pit-info-content">
        <table className="pit-table">
          <tbody>
            <tr><td>Brand</td><td>{product.brand}</td></tr>
            <tr><td>Model Name</td><td>{additionalDetails.modelNumber}</td></tr>
            <tr><td>SKU / Product ID</td><td>{product.sku}</td></tr>
            <tr><td>Country of Origin</td><td>{additionalDetails.countryOfOrigin}</td></tr>
            <tr><td>Manufacturer</td><td>{manufacturer.name}</td></tr>
            <tr><td>Importer / Packer</td><td>{manufacturer.importedBy}</td></tr>
            <tr><td>Manufacturing Date</td><td>{manufacturer.manufacturingDate}</td></tr>
            <tr><td>HSN Code</td><td>{additionalDetails.hsn}</td></tr>
            <tr><td>GST Rate</td><td>{additionalDetails.gst}</td></tr>
          </tbody>
        </table>
        {additionalDetails.certifications?.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 22 }}>Quality &amp; Safety Certifications</div>
            <div className="pit-cert-pills">
              {additionalDetails.certifications.map((c, i) => (
                <span className="pit-cert-pill" key={i}>
                  <ShieldCheck size={14} color="var(--green)" /> {c}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    details: (
      <div className="pit-details-content">
        <div className="pit-section-title">What's in the Box</div>
        <div className="pit-inbox-grid">
          {additionalDetails.inBox?.map((item, i) => (
            <div className="pit-inbox-card" key={i}>
              <span className="pit-inbox-check">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="pit-section-title" style={{ marginTop: 24 }}>Manufacturer Contact &amp; Support</div>
        <table className="pit-table">
          <tbody>
            <tr><td>Address</td><td>{manufacturer.address}</td></tr>
            <tr><td>Toll-Free Support</td><td>{manufacturer.supportPhone}</td></tr>
            <tr><td>Customer Service</td><td><a href={`mailto:${manufacturer.supportEmail}`} className="pit-link">{manufacturer.supportEmail} <ExternalLink size={12} /></a></td></tr>
          </tbody>
        </table>
      </div>
    ),

    feedback: (
      <div className="pit-feedback-content">
        <div className="pit-feedback-title">Would you like to tell us about a lower price?</div>
        <div className="pit-feedback-sub">Found a lower price elsewhere? Let us know and we'll do our best to match or beat it!</div>

        {feedbackStep === 0 && (
          <div className="pit-fb-step">
            <div className="pit-section-title" style={{ marginTop: 16 }}>1. Rate this product's current pricing value</div>
            <div className="pit-fb-stars">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`pit-fb-star ${s <= (hoverRating || feedbackRating) ? "active" : ""}`}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setFeedbackRating(s)}
                >
                  <Star size={30} fill={s <= (hoverRating || feedbackRating) ? "#f59e0b" : "none"} color={s <= (hoverRating || feedbackRating) ? "#f59e0b" : "#cbd5e1"} />
                </button>
              ))}
            </div>
            {feedbackRating > 0 && (
              <button className="pit-fb-next" onClick={() => setFeedbackStep(1)}>
                Continue to Report Lower Price →
              </button>
            )}
          </div>
        )}

        {feedbackStep === 1 && (
          <form className="pit-fb-step" onSubmit={handleFeedbackSubmit}>
            <div className="pit-section-title" style={{ marginTop: 16 }}>2. Competitor Store &amp; Price Details</div>
            <div className="pit-fb-form">
              <div className="pit-fb-field">
                <label>Website URL or Store Name</label>
                <input className="pit-fb-input" type="text" placeholder="e.g. https://store.com/item or Local Store" required />
              </div>
              <div className="pit-fb-field">
                <label>Lower Price Seen (₹)</label>
                <input className="pit-fb-input" type="number" placeholder="e.g. 23990" required />
              </div>
              <div className="pit-fb-field">
                <label>Additional details / promo codes seen</label>
                <textarea className="pit-fb-textarea" rows={3} placeholder="Tell us if there were coupons, delivery charges or bundled offers..." />
              </div>
              <div className="pit-fb-btns">
                <button type="button" className="pit-fb-back" onClick={() => setFeedbackStep(0)}>← Back</button>
                <button type="submit" className="pit-fb-submit">Submit Price Match Request</button>
              </div>
            </div>
          </form>
        )}

        {feedbackStep === 2 && (
          <div className="pit-fb-success">
            <div className="pit-fb-check">✓</div>
            <div className="pit-fb-success-title">Price Match Request Received!</div>
            <p>Our pricing analytics team has logged this report for SKU <strong>{product.sku}</strong>. We'll update the listing price if the competitor match is verified.</p>
            <button className="pit-fb-reset" onClick={() => { setFeedbackStep(0); setFeedbackRating(0); }}>Submit Another Price</button>
          </div>
        )}
      </div>
    ),

    measurements: (
      <div className="pit-measure-content">
        <div className="pit-section-title">Dimensions &amp; Physical Specifications</div>
        <div className="pit-measure-grid">
          <div className="pit-measure-card">
            <span className="pit-measure-label">Height</span>
            <span className="pit-measure-val">{dimensions.height}</span>
          </div>
          <div className="pit-measure-card">
            <span className="pit-measure-label">Width</span>
            <span className="pit-measure-val">{dimensions.width}</span>
          </div>
          <div className="pit-measure-card">
            <span className="pit-measure-label">Depth</span>
            <span className="pit-measure-val">{dimensions.depth}</span>
          </div>
          <div className="pit-measure-card">
            <span className="pit-measure-label">Weight</span>
            <span className="pit-measure-val">{dimensions.weight}</span>
          </div>
        </div>

        <div className="pit-measure-fit-box">
          <div className="pit-fit-icon">🎧</div>
          <div>
            <strong>Ergonomic Over-Ear Fit:</strong> Engineered for all-day comfort with adjustable synthetic leather headband and pressure-relieving memory foam earpads.
          </div>
        </div>
      </div>
    ),

    specs: (
      <div className="pit-specs-content">
        {specifications.map((group, i) => (
          <div className="pit-spec-group" key={i}>
            <div className="pit-spec-group-title">{group.category}</div>
            <table className="pit-table">
              <tbody>
                {group.items?.map((item, j) => (
                  <tr key={j}>
                    <td>{item.label}</td>
                    <td>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    ),

    materials: (
      <div className="pit-materials-content">
        <div className="pit-section-title">Materials Breakdown</div>
        <div className="pit-mat-grid">
          {materials.map((m, i) => (
            <div className="pit-mat-card" key={i}>
              <div className="pit-mat-part">{m.part}</div>
              <div className="pit-mat-material">{m.material}</div>
            </div>
          ))}
        </div>

        <div className="pit-section-title" style={{ marginTop: 24 }}>Care &amp; Maintenance Guidelines</div>
        <ul className="pit-care-list">
          {careInstructions.map((c, i) => (
            <li key={i}>
              <span className="pit-care-bullet">💧</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    ),

    guide: (
      <div className="pit-guide-content">
        <div className="pit-guide-header">
          <div>
            <div className="pit-section-title">User Manual &amp; Quick Start Guide</div>
            <div className="pit-guide-sub">Version {userGuide.manualVersion} • English (EN)</div>
          </div>
          <button className="pit-download-btn" onClick={() => addToast({ title: "Downloading Manual", message: "Starting PDF download for Sony WH-1000XM5 User Guide...", type: "info" })}>
            <Download size={15} /> Download PDF Guide ({userGuide.fileSize})
          </button>
        </div>

        <div className="pit-guide-steps">
          {userGuide.steps?.map((s, i) => (
            <div className="pit-step-card" key={i}>
              <div className="pit-step-num">{s.step}</div>
              <div className="pit-step-info">
                <div className="pit-step-title">{s.title}</div>
                <div className="pit-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    additional: (
      <div className="pit-additional-content">
        <div className="pit-section-title">Regulatory &amp; Compliance Details</div>
        <table className="pit-table">
          <tbody>
            <tr><td>Model Number</td><td>{additionalDetails.modelNumber}</td></tr>
            <tr><td>Country of Origin</td><td>{additionalDetails.countryOfOrigin}</td></tr>
            <tr><td>HSN Code</td><td>{additionalDetails.hsn}</td></tr>
            <tr><td>GST Rate</td><td>{additionalDetails.gst}</td></tr>
          </tbody>
        </table>

        <div className="pit-section-title" style={{ marginTop: 24 }}>Rating Breakdown Summary</div>
        <div className="pit-rating-summary">
          <div className="pit-rating-big">
            <span className="pit-big-score">{reviewSummary.overall || "4.7"}</span>
            <span className="pit-big-label">/ 5</span>
            <div className="pit-big-count">{(reviewSummary.totalReviews || 48392).toLocaleString()} ratings</div>
          </div>
          <div className="pit-rbar-list">
            {reviewSummary.breakdown?.map(b => (
              <RatingBar key={b.stars} stars={b.stars} percent={b.percent} />
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="pit-root" id="product-info-tabs-root">
      {/* ── Desktop: Horizontal Tab Navigation Carousel ── */}
      <div className="pit-tabs-wrap">
        <div className="pit-tabs-carousel-container">
          {/* Left Arrow Button */}
          <button
            type="button"
            className={`pit-tabs-arrow pit-tabs-arrow-left ${canScrollLeft ? "visible" : ""}`}
            onClick={() => handleScrollBy("left")}
            aria-label="Scroll tabs left"
            disabled={!canScrollLeft}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Scrollable Track */}
          <div
            ref={tabsTrackRef}
            className="pit-tabs pit-tabs-scroll-track"
            role="tablist"
            aria-label="Product Information Categories"
          >
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                className={`pit-tab ${activeTab === t.key ? "active" : ""}`}
                onClick={(e) => handleTabClick(t.key, e)}
              >
                <t.icon size={16} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            className={`pit-tabs-arrow pit-tabs-arrow-right ${canScrollRight ? "visible" : ""}`}
            onClick={() => handleScrollBy("right")}
            aria-label="Scroll tabs right"
            disabled={!canScrollRight}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Tab Panel Content (Only active tab rendered) */}
        <div className="pit-tab-content">
          {content[activeTab]}
        </div>
      </div>

      {/* ── Mobile: Collapsible Accordion ── */}
      <div className="pit-accordion">
        {TABS.map(t => (
          <Collapsible
            key={t.key}
            label={t.label}
            icon={t.icon}
            open={openCollapse === t.key}
            onToggle={() => setOpenCollapse(o => o === t.key ? null : t.key)}
          >
            {content[t.key]}
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
