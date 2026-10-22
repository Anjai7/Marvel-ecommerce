/**
 * The section renderer: one stored section in, one rendered section out.
 *
 * The renderer is deliberately defensive. A page is stored data, and stored
 * data can be written by an older schema version, edited by hand or left
 * half-complete: a section must never break the page it sits on. Every path
 * that cannot be rendered ends in the fallback, not in a throw.
 */

import { resolveSection } from "./registry";
import { normalizeSections, validateSection } from "../../server/lib/sectionTypes.js";

/**
 * The fallback of a section that cannot be rendered.
 *
 * It is visible in both environments in v1 — an admin must be able to see
 * that a section is broken — and it renders nothing harmful.
 */
export function UnknownSection({ type, errors, silent = false }) {
  if (silent) return <SilentUnknownSection />;

  return (
    <div className="section-fallback" data-testid="section-fallback" role="note">
      <strong>Unsupported section.</strong> <code>{String(type ?? "unknown")}</code>
      {errors?.length ? (
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The production branch of the fallback: it renders nothing at all.
 *
 * It is a separate exported function so the switch between "show the admin
 * what is broken" and "show the shopper nothing" is one line — and so the
 * silent behaviour is testable on its own.
 */
export function SilentUnknownSection() {
  return null;
}

/**
 * Render one section.
 *
 * `validateSection` decides whether the section is valid; `normalizeSections`
 * fills in the defaults of every field the admin left out. The component
 * therefore never receives `undefined` for an optional field.
 */
export function SectionRenderer({ section, products, categories }) {
  const Component = resolveSection(section?.type);
  if (!Component) return <UnknownSection type={section?.type} />;

  // Defence in depth: the database may hold data written by an older
  // schema version. A bad section must never break the page.
  const result = validateSection(section);
  if (!result.ok) {
    console.warn("[content] invalid section", section?.type, result.errors);
    return <UnknownSection type={section?.type} errors={result.errors} />;
  }

  const normalized = normalizeSections([section])[0];

  return (
    // The component comes from the registry, so it is a stable module-level
    // component and not one created during this render.
    // oxlint-disable-next-line react/static-components
    <Component
      {...normalized.data}
      style={normalized.style}
      products={products}
      categories={categories}
    />
  );
}
