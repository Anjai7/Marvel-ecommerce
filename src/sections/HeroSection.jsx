import { SectionShell, SectionLink, safeHref } from "./SectionShell";

/**
 * The hero section: an eyebrow, a heading, a subheading, an optional
 * background image and one call to action.
 *
 * The CTA is a link, not a button: a stored `cta_href` is a destination. It
 * is rendered only when it is both labelled and safe.
 */
export default function HeroSection({
  heading,
  eyebrow,
  subheading,
  image_url,
  image_alt,
  cta_label,
  cta_href,
  theme,
  style,
}) {
  const href = safeHref(cta_href);
  const showCta = Boolean(cta_label) && Boolean(href);

  return (
    <SectionShell style={style} className={`section-hero section-hero--${theme || "light"}`}>
      <div className="section-hero__body">
        {eyebrow ? <p className="section-hero__eyebrow">{eyebrow}</p> : null}
        <h2 className="section-hero__heading">{heading}</h2>
        {subheading ? <p className="section-hero__subheading">{subheading}</p> : null}
        {showCta ? (
          <SectionLink href={href} variant="accent" size="lg" className="section-hero__cta">
            {cta_label}
          </SectionLink>
        ) : null}
      </div>

      {image_url ? (
        <div className="section-hero__media">
          <img src={image_url} alt={image_alt || ""} loading="lazy" />
        </div>
      ) : null}
    </SectionShell>
  );
}
