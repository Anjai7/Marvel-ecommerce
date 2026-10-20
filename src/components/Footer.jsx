import React from "react";
import { useContent } from "../context/ContentContext";
import { SimpleTooltip } from "./ui";
import { ShieldCheck, Truck, RefreshCw, Headset, Lock, ChevronRight } from "lucide-react";

/* ── Inline social SVGs (lucide-react doesn't ship these brand icons) ── */
const SocialFacebook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const SocialTwitter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);
const SocialInstagram = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const SocialYoutube = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
    <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
  </svg>
);
const SocialLinkedin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

/* Marketing micro-copy: intentionally kept in code, out of scope for the CMS. */
const PAYMENTS = ["VISA", "Mastercard", "RuPay", "UPI", "PayTM", "NetBanking"];

export default function Footer() {
  const { footer, loading, error } = useContent();

  const sections = Array.isArray(footer?.sections) ? footer.sections : [];
  const flatLinks = Array.isArray(footer?.links) ? footer.links : [];
  const columns = sections.filter((section) => section.section_type !== "tags");
  const tagsSection = sections.find((section) => section.section_type === "tags");

  const linksOf = (section) =>
    Array.isArray(section.links)
      ? section.links
      : flatLinks.filter((link) => link.section_id === section.id);

  const notice = error
    ? "Footer links are temporarily unavailable."
    : loading && sections.length === 0
      ? "Loading footer links…"
      : sections.length === 0
        ? "No footer links configured yet."
        : null;

  return (
    <footer className="footer" id="main-footer">
      {/* ── Value Proposition Bar ── */}
      <div className="footer-prop-bar">
        <div className="container footer-prop-grid">
          <div className="footer-prop-item">
            <div className="footer-prop-icon">
              <Truck size={22} />
            </div>
            <div>
              <div className="footer-prop-title">Free & Fast Delivery</div>
              <div className="footer-prop-sub">On orders over ₹499 across India</div>
            </div>
          </div>

          <div className="footer-prop-item">
            <div className="footer-prop-icon">
              <RefreshCw size={22} />
            </div>
            <div>
              <div className="footer-prop-title">7 Days Replacement</div>
              <div className="footer-prop-sub">Easy, hassle-free returns policy</div>
            </div>
          </div>

          <div className="footer-prop-item">
            <div className="footer-prop-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="footer-prop-title">100% Genuine Products</div>
              <div className="footer-prop-sub">Sourced directly from top brands</div>
            </div>
          </div>

          <div className="footer-prop-item">
            <div className="footer-prop-icon">
              <Headset size={22} />
            </div>
            <div>
              <div className="footer-prop-title">24/7 Dedicated Support</div>
              <div className="footer-prop-sub">We're here to help anytime</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Footer Links & Brand Section ── */}
      <div className="container footer-main-content">
        <div className="footer-grid">
          {/* Brand & Newsletter Column */}
          <div className="footer-brand-col">
            <a href="/" className="footer-logo-wrap">
              <img src="/header.png" alt="MARVEL MARKET Logo" className="footer-logo-img" />
            </a>
            <p className="footer-brand-desc">
              Your ultimate online shopping destination for top electronics, fashion, home
              essentials, and lifestyle products with unbeatable deals and fast doorstep delivery.
            </p>

            {/* Social Links */}
            <div className="footer-socials">
              <span className="social-label">Follow Us:</span>
              <SimpleTooltip content="Facebook">
                <a href="#" className="social-icon-btn facebook" aria-label="Facebook">
                  <SocialFacebook />
                </a>
              </SimpleTooltip>
              <SimpleTooltip content="Twitter">
                <a href="#" className="social-icon-btn twitter" aria-label="Twitter">
                  <SocialTwitter />
                </a>
              </SimpleTooltip>
              <SimpleTooltip content="Instagram">
                <a href="#" className="social-icon-btn instagram" aria-label="Instagram">
                  <SocialInstagram />
                </a>
              </SimpleTooltip>
              <SimpleTooltip content="YouTube">
                <a href="#" className="social-icon-btn youtube" aria-label="YouTube">
                  <SocialYoutube />
                </a>
              </SimpleTooltip>
              <SimpleTooltip content="LinkedIn">
                <a href="#" className="social-icon-btn linkedin" aria-label="LinkedIn">
                  <SocialLinkedin />
                </a>
              </SimpleTooltip>
            </div>
          </div>

          {/* Nav Columns */}
          {notice ? (
            <div className="footer-col">
              <p style={{ fontSize: 13, color: "var(--gray-400)" }}>{notice}</p>
            </div>
          ) : (
            columns.map((col) => (
              <div className="footer-col" key={col.id ?? col.heading}>
                <h4 className="footer-col-title">{col.heading}</h4>
                <ul className="footer-col-list">
                  {linksOf(col).map((link) => (
                    <li key={link.id ?? link.label} className="footer-link-item">
                      <a href={link.href || "#"} className="footer-link">
                        <ChevronRight size={12} className="footer-link-arrow" />
                        <span>{link.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* ── Popular Search Tags Bar ── */}
        {!notice && tagsSection && linksOf(tagsSection).length > 0 && (
          <div className="footer-tags-bar">
            <span className="tags-title">{tagsSection.heading}:</span>
            <div className="tags-list">
              {linksOf(tagsSection).map((tag) => (
                <a key={tag.id ?? tag.label} href={tag.href || "#"} className="search-tag-chip">
                  {tag.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom Copyright & Payments Bar ── */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            <span>© 2026 Marvel Inc. All Rights Reserved.</span>
            <span className="footer-security-note">
              <Lock size={12} color="var(--green)" /> 128-bit SSL Encrypted & Secure Shopping
            </span>
          </div>

          <div className="payment-methods-row">
            <span className="pay-label">100% Safe Payments:</span>
            <div className="payment-badges">
              {PAYMENTS.map((p) => (
                <span className="pay-chip" key={p}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
