import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Info,
  Package,
  Ruler,
  Zap,
  Droplets,
  BookOpen,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Tag,
  CreditCard,
  Download,
  ExternalLink,
  Star,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

import { useToast } from "../ui";
import { formatCurrency } from "../../lib/currency";

/** Tab definitions. A tab is only offered when the product has its data. */
const TAB_DEFINITIONS = [
  { key: "offers", label: "Price & Offers", icon: Tag },
  { key: "info", label: "Product Information", icon: Info },
  { key: "details", label: "Item Details", icon: Package },
  { key: "measurements", label: "Measurements", icon: Ruler },
  { key: "specs", label: "Features & Specs", icon: Zap },
  { key: "materials", label: "Materials & Care", icon: Droplets },
  { key: "guide", label: "User Guide", icon: BookOpen },
  { key: "additional", label: "Additional Details", icon: MoreHorizontal },
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
      <span className="pit-rbar-stars">
        {stars} <Star size={12} fill="#f59e0b" color="#f59e0b" />
      </span>
      <div className="pit-rbar-track">
        <div className="pit-rbar-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="pit-rbar-pct">{percent}%</span>
    </div>
  );
}

/** Rows whose value the API actually provided. */
function presentRows(rows) {
  return rows.filter(([, value]) => Boolean(value));
}

export default function ProductInfoTabs({ product }) {
  const [activeTab, setActiveTab] = useState("offers");
  const [openCollapse, setOpenCollapse] = useState("offers");
  const [copiedCode, setCopiedCode] = useState(null);
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

  if (!product) return null;

  const {
    offers = { emi: [], bank: [], coupon: [] },
    specifications = [],
    dimensions = [],
    materials = [],
    careInstructions = [],
    manufacturer = null,
    userGuide = null,
    additionalDetails = {},
    inBox = [],
    certifications = [],
    highlights = [],
    reviewSummary = { overall: null, total: 0, breakdown: [] },
  } = product;

  const offerCount = offers.emi.length + offers.bank.length + offers.coupon.length;

  const infoRows = presentRows([
    ["Brand", product.brand],
    ["Model Name", additionalDetails.modelNumber],
    ["SKU / Product ID", product.sku],
    ["Country of Origin", additionalDetails.countryOfOrigin],
    ["Manufacturer", manufacturer?.name],
    ["Importer / Packer", manufacturer?.importedBy],
    ["Manufacturing Date", manufacturer?.manufacturingDate],
    ["HSN Code", additionalDetails.hsn],
    ["GST Rate", additionalDetails.gst],
  ]);

  const supportRows = presentRows([
    ["Address", manufacturer?.address],
    ["Support Phone", manufacturer?.supportPhone],
    ["Customer Service", manufacturer?.supportEmail],
  ]);

  const additionalRows = presentRows([
    ["Model Number", additionalDetails.modelNumber],
    ["Country of Origin", additionalDetails.countryOfOrigin],
    ["HSN Code", additionalDetails.hsn],
    ["GST Rate", additionalDetails.gst],
  ]);

  // ── Only offer a tab when its data exists ──────────────────────
  const hasTab = {
    offers: offerCount > 0,
    info: Boolean(product.description) || infoRows.length > 0,
    details: inBox.length > 0 || supportRows.length > 0 || Boolean(product.warranty),
    measurements: dimensions.length > 0,
    specs: specifications.length > 0 || highlights.length > 0,
    materials: materials.length > 0 || careInstructions.length > 0,
    guide: Boolean(userGuide),
    additional: additionalRows.length > 0 || certifications.length > 0 || reviewSummary.total > 0,
  };

  const tabs = TAB_DEFINITIONS.filter((tab) => hasTab[tab.key]);
  if (tabs.length === 0) return null;

  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0].key;
  const currentCollapse = tabs.some((tab) => tab.key === openCollapse) ? openCollapse : null;

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

  const copyCoupon = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    addToast({
      title: "Coupon Copied!",
      message: `Code ${code} copied to clipboard. Apply at checkout.`,
      type: "success",
    });
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // ── Tab Panel Content Dictionary ──────────────────────────────
  const content = {
    offers: (
      <div className="pit-offers-content">
        {offers.emi.length > 0 && (
          <>
            <div className="pit-section-title">
              <CreditCard size={17} color="var(--navy)" /> EMI Plans
            </div>
            <div className="pit-emi-grid">
              {offers.emi.map((opt, index) => (
                <div className="pit-emi-card" key={`${opt.months}-${index}`}>
                  <div className="pit-emi-months">
                    {opt.months !== null ? `${opt.months} Months` : (opt.title ?? "EMI")}
                  </div>
                  <div className="pit-emi-amount">
                    {opt.amount !== null ? formatCurrency(opt.amount) : "—"}
                    {opt.amount !== null && <span>/mo</span>}
                  </div>
                  <div className={`pit-emi-interest ${opt.interest === "No Cost" ? "free" : ""}`}>
                    {opt.interest ?? opt.description ?? ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {offers.bank.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Partner Bank Offers
            </div>
            <div className="pit-bank-list">
              {offers.bank.map((o, i) => (
                <div className="pit-bank-row" key={i}>
                  {o.bank && <div className="pit-bank-icon">{o.bank.charAt(0)}</div>}
                  <div className="pit-bank-details">
                    {o.bank && <div className="pit-bank-name">{o.bank}</div>}
                    <div className="pit-bank-desc">{o.description ?? o.title ?? o.code}</div>
                    {o.code && (
                      <button className="pit-code-pill" onClick={() => copyCoupon(o.code)}>
                        {copiedCode === o.code ? (
                          <>
                            <Check size={12} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Code: {o.code}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {offers.coupon.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Promo Codes
            </div>
            <div className="pit-coupon-grid">
              {offers.coupon.map((o, i) => (
                <div className="pit-coupon-card" key={i}>
                  <div className="pit-coupon-top">
                    <span className="pit-coupon-code">{o.code ?? o.title}</span>
                    {o.code && (
                      <button className="pit-coupon-copy-btn" onClick={() => copyCoupon(o.code)}>
                        {copiedCode === o.code ? (
                          <Check size={14} color="#16a34a" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="pit-coupon-desc">{o.description ?? o.title ?? ""}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    info: (
      <div className="pit-info-content">
        {product.description && (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--gray-600, #475569)",
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            {product.description}
          </p>
        )}
        {infoRows.length > 0 && (
          <table className="pit-table">
            <tbody>
              {infoRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {certifications.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 22 }}>
              Quality &amp; Safety Certifications
            </div>
            <div className="pit-cert-pills">
              {certifications.map((certification, i) => (
                <span className="pit-cert-pill" key={i}>
                  <ShieldCheck size={14} color="var(--green)" /> {certification}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    details: (
      <div className="pit-details-content">
        {inBox.length > 0 && (
          <>
            <div className="pit-section-title">What&apos;s in the Box</div>
            <div className="pit-inbox-grid">
              {inBox.map((item, i) => (
                <div className="pit-inbox-card" key={i}>
                  <span className="pit-inbox-check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {product.warranty && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Warranty
            </div>
            <p style={{ fontSize: 13.5, color: "var(--gray-600, #475569)", lineHeight: 1.7 }}>
              {product.warranty}
            </p>
          </>
        )}

        {supportRows.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Manufacturer Contact &amp; Support
            </div>
            <table className="pit-table">
              <tbody>
                {supportRows.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>
                      {label === "Customer Service" ? (
                        <a href={`mailto:${value}`} className="pit-link">
                          {value} <ExternalLink size={12} />
                        </a>
                      ) : (
                        value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    ),

    measurements: (
      <div className="pit-measure-content">
        <div className="pit-section-title">Dimensions &amp; Physical Specifications</div>
        <div className="pit-dim-grid">
          {dimensions.map((row) => (
            <div className="pit-dim-card" key={row.label}>
              <span className="pit-dim-label">{row.label}</span>
              <span className="pit-dim-value">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),

    specs: (
      <div className="pit-specs-content">
        {highlights.length > 0 && (
          <div className="pit-spec-group">
            <div className="pit-spec-group-label">Highlights</div>
            <ul className="pd-highlight-list">
              {highlights.map((highlight, i) => (
                <li key={i}>
                  <Check size={14} className="pd-hl-check" /> <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {specifications.map((group, i) => (
          <div className="pit-spec-group" key={i}>
            {group.category && <div className="pit-spec-group-label">{group.category}</div>}
            <table className="pit-table">
              <tbody>
                {group.items.map((item, j) => (
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
        {materials.length > 0 && (
          <>
            <div className="pit-section-title">Materials Breakdown</div>
            <div className="pit-materials-grid">
              {materials.map((material, i) => (
                <div className="pit-material-card" key={i}>
                  {material.part && <div className="pit-material-part">{material.part}</div>}
                  <div className="pit-material-val">{material.material}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {careInstructions.length > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Care &amp; Maintenance Guidelines
            </div>
            <ul className="pit-care-list">
              {careInstructions.map((instruction, i) => (
                <li key={i}>
                  <span className="pit-care-bullet">💧</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    ),

    guide: userGuide ? (
      <div className="pit-guide-content">
        <div className="pit-guide-top">
          <div>
            <div className="pit-section-title">User Manual &amp; Quick Start Guide</div>
            {(userGuide.version || userGuide.fileSize) && (
              <div className="pit-sc-sub">
                {[userGuide.version ? `Version ${userGuide.version}` : null, userGuide.fileSize]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
          {userGuide.url && (
            <a
              className="pit-pdf-btn"
              href={userGuide.url}
              target="_blank"
              rel="noreferrer"
              download
            >
              <Download size={15} /> Download Guide
            </a>
          )}
        </div>

        {userGuide.steps.length > 0 && (
          <div className="pit-guide-steps">
            {userGuide.steps.map((step, i) => (
              <div className="pit-guide-step" key={i}>
                <div className="pit-step-num">{step.step}</div>
                <div className="pit-step-info">
                  {step.title && <div className="pit-step-title">{step.title}</div>}
                  {step.desc && <div className="pit-step-desc">{step.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null,

    additional: (
      <div className="pit-additional-content">
        {additionalRows.length > 0 && (
          <>
            <div className="pit-section-title">Regulatory &amp; Compliance Details</div>
            <table className="pit-table">
              <tbody>
                {additionalRows.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {reviewSummary.total > 0 && (
          <>
            <div className="pit-section-title" style={{ marginTop: 24 }}>
              Rating Breakdown Summary
            </div>
            <div className="pit-rating-summary">
              <div className="pit-rating-big">
                <span className="pit-big-score">
                  {reviewSummary.overall !== null ? reviewSummary.overall : "—"}
                </span>
                <span className="pit-big-label">/ 5</span>
                <div className="pit-big-count">{reviewSummary.total.toLocaleString()} ratings</div>
              </div>
              <div className="pit-rbar-list">
                {reviewSummary.breakdown.map((row) => (
                  <RatingBar key={row.stars} stars={row.stars} percent={row.percent} />
                ))}
              </div>
            </div>
          </>
        )}
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
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={currentTab === tab.key}
                className={`pit-tab ${currentTab === tab.key ? "active" : ""}`}
                onClick={(e) => handleTabClick(tab.key, e)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
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
        <div className="pit-tab-content">{content[currentTab]}</div>
      </div>

      {/* ── Mobile: Collapsible Accordion ── */}
      <div className="pit-accordion">
        {tabs.map((tab) => (
          <Collapsible
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            open={currentCollapse === tab.key}
            onToggle={() => setOpenCollapse((open) => (open === tab.key ? null : tab.key))}
          >
            {content[tab.key]}
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
