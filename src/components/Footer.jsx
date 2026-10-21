import React from "react";
import { useContent } from "../context/ContentContext";
import { useSettings } from "../context/SettingsContext";
import { SimpleTooltip } from "./ui";
import { toAppHref } from "./ui/linkTarget";
import {
  ShieldCheck,
  Truck,
  RefreshCw,
  Headset,
  Lock,
  ChevronRight,
  Package,
  Star,
  Gift,
  CreditCard,
  Heart,
  BadgeCheck,
  Sparkles,
  RotateCcw,
} from "lucide-react";

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

/* ── Icon registries: the backend stores icon NAMES, not components ── */
const normalizeIconName = (name) =>
  typeof name === "string" ? name.toLowerCase().replace(/[^a-z0-9]/g, "") : "";

const VALUE_PROP_ICONS = {
  truck: Truck,
  delivery: Truck,
  refreshcw: RefreshCw,
  refresh: RefreshCw,
  returns: RotateCcw,
  rotateccw: RotateCcw,
  shieldcheck: ShieldCheck,
  shield: ShieldCheck,
  headset: Headset,
  support: Headset,
  package: Package,
  star: Star,
  gift: Gift,
  creditcard: CreditCard,
  heart: Heart,
  badgecheck: BadgeCheck,
  sparkles: Sparkles,
  lock: Lock,
};

const SOCIAL_ICONS = {
  facebook: SocialFacebook,
  twitter: SocialTwitter,
  x: SocialTwitter,
  instagram: SocialInstagram,
  youtube: SocialYoutube,
  linkedin: SocialLinkedin,
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (typeof value === "string" && value.trim() !== "" ? value : "");

export default function Footer() {
  const { footer, loading, errors } = useContent();
  const { settings } = useSettings();
  const error = errors?.footer ?? null;

  const footerSettings =
    settings?.footer && typeof settings.footer === "object" && !Array.isArray(settings.footer)
      ? settings.footer
      : null;

  // Every marketing block comes from the backend; a missing key renders
  // nothing rather than a hardcoded copy.
  const valueProps = asArray(footerSettings?.value_props);
  const paymentMethods = asArray(footerSettings?.payment_methods).filter(
    (method) => typeof method === "string" && method.trim() !== ""
  );
  const socials = asArray(footerSettings?.socials).filter(
    (social) => social && (asText(social.label) || asText(social.href))
  );
  const copyright = asText(footerSettings?.copyright);
  const securityNote = asText(footerSettings?.security_note);
  const brandLogo = asText(footerSettings?.brand_logo);
  const brandAlt = asText(footerSettings?.brand_alt);
  const storeDescription = asText(settings?.store?.description);

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

  const hasBottomBar = Boolean(copyright || securityNote || paymentMethods.length > 0);

  return (
    <footer className="footer" id="main-footer">
      {/* ── Value Proposition Bar (settings.footer.value_props) ── */}
      {valueProps.length > 0 && (
        <div className="footer-prop-bar">
          <div className="container footer-prop-grid">
            {valueProps.map((prop, index) => {
              const Icon = VALUE_PROP_ICONS[normalizeIconName(prop?.icon)];
              const title = asText(prop?.title);
              if (!title) return null;
              const subtitle = asText(prop?.subtitle);
              return (
                <div className="footer-prop-item" key={`${title}-${index}`}>
                  {Icon && (
                    <div className="footer-prop-icon">
                      <Icon size={22} />
                    </div>
                  )}
                  <div>
                    <div className="footer-prop-title">{title}</div>
                    {subtitle && <div className="footer-prop-sub">{subtitle}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Footer Links & Brand Section ── */}
      <div className="container footer-main-content">
        <div className="footer-grid">
          {/* Brand & Newsletter Column */}
          <div className="footer-brand-col">
            {brandLogo && (
              <a href="/" className="footer-logo-wrap">
                <img src={brandLogo} alt={brandAlt} className="footer-logo-img" />
              </a>
            )}
            {storeDescription && <p className="footer-brand-desc">{storeDescription}</p>}

            {/* Social Links (settings.footer.socials) */}
            {socials.length > 0 && (
              <div className="footer-socials">
                <span className="social-label">Follow Us:</span>
                {socials.map((social, index) => {
                  const label = asText(social.label);
                  const href = asText(social.href);
                  const key = normalizeIconName(social.icon) || normalizeIconName(label);
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <SimpleTooltip content={label} key={`${label || href}-${index}`}>
                      <a
                        href={href || "#"}
                        className={`social-icon-btn ${key}`}
                        aria-label={label || undefined}
                      >
                        {Icon ? <Icon /> : label ? <span>{label}</span> : null}
                      </a>
                    </SimpleTooltip>
                  );
                })}
              </div>
            )}
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
                      <a href={toAppHref(link.href)} className="footer-link">
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
                <a key={tag.id ?? tag.label} href={toAppHref(tag.href)} className="search-tag-chip">
                  {tag.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom Copyright & Payments Bar (settings.footer.*) ── */}
        {hasBottomBar && (
          <div className="footer-bottom">
            {(copyright || securityNote) && (
              <div className="footer-copyright">
                {copyright && <span>{copyright}</span>}
                {securityNote && (
                  <span className="footer-security-note">
                    <Lock size={12} color="var(--green)" /> {securityNote}
                  </span>
                )}
              </div>
            )}

            {paymentMethods.length > 0 && (
              <div className="payment-methods-row">
                <span className="pay-label">100% Safe Payments:</span>
                <div className="payment-badges">
                  {paymentMethods.map((method) => (
                    <span className="pay-chip" key={method}>
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
