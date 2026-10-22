import { SectionShell, safeHref } from "./SectionShell";

/**
 * The category grid section: a grid of category tiles.
 *
 * The section does not fetch. The caller resolves the categories the section
 * refers to and passes them in through `categories`.
 *
 * A tile links to the **full** category path, because a slug is unique only
 * per parent: `/category/electronics/mobiles` finds the category, `/category/
 * mobiles` may find a different one.
 */

/** The path of a category, without the `category/` prefix the router adds. */
function categoryPath(category) {
  const raw =
    typeof category?.path === "string" && category.path.trim()
      ? category.path.trim()
      : category?.slug;
  if (typeof raw !== "string" || !raw.trim()) return "";
  return raw
    .trim()
    .replace(/^#/, "")
    .replace(/^\/+/, "")
    .replace(/^category\//, "");
}

/** The categories a category grid shows. */
function selectCategories(categories, { category_ids, source_parent_id, limit } = {}) {
  const list = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const ids = Array.isArray(category_ids)
    ? category_ids.filter((id) => typeof id === "string" && id !== "")
    : [];

  let selected;
  if (ids.length) {
    const byId = new Map(list.map((category) => [String(category?.id), category]));
    selected = ids.map((id) => byId.get(String(id))).filter(Boolean);
  } else if (source_parent_id) {
    selected = list.filter(
      (category) => String(category?.parent_id ?? "") === String(source_parent_id)
    );
  } else {
    selected = list;
  }

  const cap = Number(limit);
  if (Number.isFinite(cap) && cap > 0) selected = selected.slice(0, cap);
  return selected;
}

export default function CategoryGridSection({
  category_ids,
  source_parent_id,
  limit,
  columns,
  style,
  categories,
}) {
  const items = selectCategories(categories, { category_ids, source_parent_id, limit });
  const count = Number(columns);
  const columnCount = Number.isFinite(count) ? Math.min(4, Math.max(2, count)) : 3;

  if (!items.length) return null;

  return (
    <SectionShell style={style} className="section-category-grid">
      <div
        className="section-category-grid__items"
        style={{ "--section-category-columns": columnCount }}
      >
        {items.map((category, index) => {
          const path = categoryPath(category);
          const href = path ? safeHref(`/category/${path}`) : null;
          const image = category?.image_url || category?.image || "";
          const name = category?.name || category?.title || "Category";

          const tile = (
            <>
              {image ? (
                <span className="section-category-grid__media">
                  <img src={image} alt="" loading="lazy" />
                </span>
              ) : (
                <span className="section-category-grid__media section-category-grid__media--empty" />
              )}
              <span className="section-category-grid__name">{name}</span>
            </>
          );

          return (
            <div className="section-category-grid__item" key={category?.id ?? `${name}-${index}`}>
              {href ? (
                <a href={href} className="section-category-grid__link">
                  {tile}
                </a>
              ) : (
                <span className="section-category-grid__link section-category-grid__link--static">
                  {tile}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
