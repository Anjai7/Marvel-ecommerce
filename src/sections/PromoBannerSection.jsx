import { Badge } from "../components/ui/Badge";
import { SectionShell, SectionLink, safeHref } from "./SectionShell";

/**
 * The promotional banner: a badge, a short message, an optional image and one
 * call to action.
 *
 * The banner image is decorative — the promo_banner type stores no alt text
 * — so it carries an empty `alt` and is hidden from assistive technology.
 */
export default function PromoBannerSection({
  title,
  badge,
  subtitle,
  image_url,
  cta_label,
  cta_href,
  theme,
  style,
}) {
  const href = safeHref(cta_href);
  const showCta = Boolean(cta_label) && Boolean(href);

  return (
    <SectionShell style={style} className={`section-promo section-promo--${theme || "light"}`}>
      <div className="section-promo__body">
        {badge ? (
          <Badge variant="accent" className="section-promo__badge">
            {badge}
          </Badge>
        ) : null}
        <h3 className="section-promo__title">{title}</h3>
        {subtitle ? <p className="section-promo__subtitle">{subtitle}</p> : null}
        {showCta ? (
          <SectionLink href={href} variant="accent" size="sm" className="section-promo__cta">
            {cta_label}
          </SectionLink>
        ) : null}
      </div>

      {image_url ? (
        <div className="section-promo__media">
          <img src={image_url} alt="" loading="lazy" />
        </div>
      ) : null}
    </SectionShell>
  );
}
