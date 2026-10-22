import { SectionShell, safeHref } from "./SectionShell";

/**
 * The image section: one image with its alt text, optionally wrapped in a
 * link.
 *
 * The link is rendered only when the stored href is safe; an unsafe href
 * leaves the image unwrapped rather than producing a broken anchor.
 */
export default function ImageSection({ image_url, image_alt, href, style }) {
  const target = safeHref(href);

  const image = <img src={image_url} alt={image_alt || ""} loading="lazy" />;

  return (
    <SectionShell style={style} className="section-image">
      <div className="section-image__frame">
        {target ? (
          <a href={target} className="section-image__link">
            {image}
          </a>
        ) : (
          image
        )}
      </div>
    </SectionShell>
  );
}
