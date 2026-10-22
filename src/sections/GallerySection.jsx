import { SectionShell } from "./SectionShell";

/**
 * The gallery section: a grid or a carousel of images, each with its own alt
 * text.
 *
 * `columns` is the number of columns of the grid (1–4); the carousel scrolls
 * horizontally instead.
 */
export default function GallerySection({ images, columns, carousel, style }) {
  const items = Array.isArray(images) ? images.filter(Boolean) : [];
  const count = Number(columns);
  const columnCount = Number.isFinite(count) ? Math.min(4, Math.max(1, count)) : 3;

  if (!items.length) return null;

  return (
    <SectionShell style={style} className="section-gallery">
      <div
        className={`section-gallery__track ${carousel ? "is-carousel" : "is-grid"}`}
        style={{ "--section-gallery-columns": columnCount }}
      >
        {items.map((image, index) => (
          <figure key={`${image?.url || "image"}-${index}`} className="section-gallery__item">
            <img src={image?.url} alt={image?.alt || ""} loading="lazy" />
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}
