/**
 * The shared section-type schema for the CMS page builder.
 *
 * This module is the single source of truth for the section catalogue: the API
 * validates a section before it is stored, the storefront validates it again
 * before it renders, and the admin form generator reads the same field rules
 * to build its controls.
 *
 * It is imported by the **browser bundle** (`src/content/registry.jsx`), so it
 * must stay plain ESM JavaScript: no Node APIs, no `node:*` imports, no
 * Express, no JSX, no filesystem access. `new URL`, `Object.hasOwn` and
 * `Object.freeze` are web standards and are available everywhere.
 *
 * A field rule is `{ type, required?, max?, values?, default?, items? }`:
 *
 *   - `string` — a string; `max` is the character limit.
 *   - `text`   — a string that may contain newlines; `max` is the character limit.
 *   - `url`    — an image/asset URL: `isSafeUrl` and **not** a hash route.
 *   - `link`   — a destination: `isSafeUrl` **or** a value starting with `#/`.
 *   - `enum`   — a string in `values`.
 *   - `boolean`— `true` or `false`.
 *   - `number` — a finite number; `min`/`max` are optional bounds.
 *   - `uuid_list` — an array of lowercase UUID strings; `max` caps the count.
 *   - `item_list` — an array of objects; `items` names the required string
 *     keys of each entry and `max` caps the count.
 */

/** The only URL schemes a stored link may use. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** A canonical lowercase UUID — what Postgres hands back for a uuid column. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Recursively freeze a plain data structure so the catalogue cannot drift. */
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

/** True for a value object (not an array, not null). */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * True when a value carries nothing: `undefined`, `null` or a blank string.
 * A blank string is "absent" rather than "wrong" so that an empty form input
 * is not reported as a type error, and `false`/`0` are never mistaken for
 * absence.
 */
function isBlank(value) {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.trim() === "";
}

/**
 * The twelve section types. `type` is the discriminator, `data` is the
 * per-type payload and `style` is shared by every type.
 */
export const SECTION_TYPES = deepFreeze({
  hero: {
    label: "Hero banner",
    description: "A full-width banner with a heading, an optional image and one call to action.",
    fields: {
      heading: { type: "string", required: true, max: 120, default: "" },
      eyebrow: { type: "string", max: 60, default: "" },
      subheading: { type: "string", max: 300, default: "" },
      image_url: { type: "url", max: 500, default: "" },
      image_alt: { type: "string", max: 160, default: "" },
      cta_label: { type: "string", max: 60, default: "" },
      cta_href: { type: "link", max: 500, default: "" },
      theme: { type: "enum", values: ["light", "dark", "gradient"], default: "light" },
    },
  },
  richtext: {
    label: "Rich text",
    description: "A block of markdown text with headings, lists, links and emphasis.",
    fields: {
      body: { type: "text", required: true, max: 20000, default: "" },
      align: { type: "enum", values: ["left", "center", "right"], default: "left" },
    },
  },
  image: {
    label: "Image",
    description: "One image, with optional alt text and an optional link.",
    fields: {
      image_url: { type: "url", required: true, max: 500, default: "" },
      image_alt: { type: "string", max: 160, default: "" },
      href: { type: "link", max: 500, default: "" },
    },
  },
  gallery: {
    label: "Image gallery",
    description: "A grid or carousel of images with per-image alt text.",
    fields: {
      images: { type: "item_list", required: true, items: ["url", "alt"], max: 24, default: [] },
      columns: { type: "number", min: 1, max: 4, default: 3 },
      carousel: { type: "boolean", default: false },
    },
  },
  product_grid: {
    label: "Product grid",
    description: "A grid of products chosen by id, by source category, or by the newest arrivals.",
    fields: {
      product_ids: { type: "uuid_list", max: 24, default: [] },
      source_category_id: { type: "string", max: 36, default: "" },
      limit: { type: "number", min: 1, max: 48, default: 12 },
      columns: { type: "number", min: 2, max: 4, default: 4 },
      layout: { type: "enum", values: ["grid", "carousel", "list"], default: "grid" },
      show_price: { type: "boolean", default: true },
    },
  },
  category_grid: {
    label: "Category grid",
    description: "A grid of category tiles chosen by id or by source parent category.",
    fields: {
      category_ids: { type: "uuid_list", max: 24, default: [] },
      source_parent_id: { type: "string", max: 36, default: "" },
      limit: { type: "number", min: 1, max: 48, default: 12 },
      columns: { type: "number", min: 2, max: 4, default: 3 },
    },
  },
  promo_banner: {
    label: "Promotional banner",
    description: "A promotional strip with a badge, a short message and one call to action.",
    fields: {
      title: { type: "string", required: true, max: 120, default: "" },
      badge: { type: "string", max: 40, default: "" },
      subtitle: { type: "string", max: 200, default: "" },
      image_url: { type: "url", max: 500, default: "" },
      cta_label: { type: "string", max: 60, default: "" },
      cta_href: { type: "link", max: 500, default: "" },
      theme: { type: "enum", values: ["light", "dark", "primary"], default: "light" },
    },
  },
  cta: {
    label: "Call to action",
    description: "A heading, a short message and one button.",
    fields: {
      heading: { type: "string", required: true, max: 120, default: "" },
      body: { type: "text", max: 1000, default: "" },
      button_label: { type: "string", max: 60, default: "" },
      button_href: { type: "link", max: 500, default: "" },
      align: { type: "enum", values: ["left", "center", "right"], default: "center" },
    },
  },
  faq: {
    label: "FAQ",
    description: "A list of question-and-answer pairs.",
    fields: {
      items: {
        type: "item_list",
        required: true,
        items: ["question", "answer"],
        max: 50,
        default: [],
      },
    },
  },
  video: {
    label: "Video",
    description: "A video with an optional poster image and playback flags.",
    fields: {
      video_url: { type: "url", required: true, max: 500, default: "" },
      poster_url: { type: "url", max: 500, default: "" },
      autoplay: { type: "boolean", default: false },
      muted: { type: "boolean", default: true },
      loop: { type: "boolean", default: false },
    },
  },
  category_listing: {
    label: "Category product listing",
    description: "The product listing of a category page, with layout, sorting and filters.",
    fields: {
      layout: { type: "enum", values: ["grid", "list"], default: "grid" },
      sort: {
        type: "enum",
        values: ["featured", "newest", "price_asc", "price_desc", "rating"],
        default: "featured",
      },
      page_size: { type: "number", min: 0, max: 100, default: 12 },
      in_stock_only: { type: "boolean", default: false },
      min_price: { type: "number", min: 0, default: 0 },
      max_price: { type: "number", min: 0, default: 0 },
    },
  },
  spacer: {
    label: "Spacer",
    description: "Empty vertical space, for separating sections.",
    fields: {
      height: { type: "number", min: 8, max: 320, default: 48 },
    },
  },
});

/** The style block every section shares. */
export const SECTION_STYLE_FIELDS = deepFreeze({
  background: {
    type: "enum",
    values: ["none", "surface", "muted", "primary", "dark"],
    default: "none",
  },
  padding_top: { type: "enum", values: ["none", "sm", "md", "lg", "xl"], default: "md" },
  padding_bottom: { type: "enum", values: ["none", "sm", "md", "lg", "xl"], default: "md" },
  max_width: { type: "enum", values: ["full", "content", "narrow"], default: "content" },
  align: { type: "enum", values: ["left", "center", "right"], default: "left" },
});

/** The twelve type names, in catalogue order. */
export const SECTION_TYPE_NAMES = Object.freeze(Object.keys(SECTION_TYPES));

/** The maximum number of sections one page may hold. */
export const SECTION_MAX = 24;

/**
 * True when a URL is safe to store and to render as a link.
 *
 * The scheme is resolved with `new URL(value, base)` and checked against an
 * explicit allowlist, so `javascript:`, `data:` and a newline-obfuscated
 * `java\nscript:` are all rejected — a `startsWith` check alone would not
 * catch the obfuscated form, because the URL parser strips the newline before
 * the scheme is read.
 *
 * A site-relative path (`/pages/x`) is allowed; a protocol-relative
 * `//host` is not — it silently points at another origin.
 */
export function isSafeUrl(value, base = "http://localhost") {
  if (typeof value !== "string" || value.trim() === "") return false;
  const v = value.trim();
  if (v.startsWith("//")) return false;
  if (v.startsWith("/")) return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(v, base).protocol);
  } catch {
    return false;
  }
}

/**
 * True when a value is a link destination: a safe URL or a hash route such as
 * `#/category/electronics`. A bare fragment (`#top`) is not a destination in
 * this app — the router is hash-based, so only `#/…` routes are navigable.
 */
function isLinkValue(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.startsWith("#/")) return true;
  if (v.startsWith("#")) return false;
  return isSafeUrl(v);
}

/**
 * Check one field value against its rule. Returns the list of problems; an
 * empty list means the value is acceptable.
 */
function checkFieldValue(prefix, name, rule, value) {
  const errors = [];
  const label = `${prefix}.${name}`;

  switch (rule.type) {
    case "string":
    case "text": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string.`);
        break;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${label} must be at most ${rule.max} characters.`);
      }
      break;
    }
    case "url": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a URL string.`);
        break;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${label} must be at most ${rule.max} characters.`);
      }
      const v = value.trim();
      if (v.startsWith("#")) {
        errors.push(`${label} must be an asset URL, not a hash route.`);
        break;
      }
      if (!isSafeUrl(v)) {
        errors.push(
          `${label} must be a safe URL (http, https, mailto, tel or a site-relative path).`
        );
      }
      break;
    }
    case "link": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a link string.`);
        break;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${label} must be at most ${rule.max} characters.`);
      }
      if (!isLinkValue(value)) {
        errors.push(`${label} must be a safe URL or a hash route starting with #/.`);
      }
      break;
    }
    case "enum": {
      if (typeof value !== "string") {
        errors.push(`${label} must be a string.`);
        break;
      }
      if (!rule.values.includes(value)) {
        errors.push(`${label} must be one of: ${rule.values.join(", ")}.`);
      }
      break;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push(`${label} must be true or false.`);
      }
      break;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${label} must be a finite number.`);
        break;
      }
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${label} must be at least ${rule.min}.`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${label} must be at most ${rule.max}.`);
      }
      break;
    }
    case "uuid_list": {
      if (!Array.isArray(value)) {
        errors.push(`${label} must be an array of UUIDs.`);
        break;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${label} must have at most ${rule.max} entries.`);
      }
      const invalid = value.some((entry) => typeof entry !== "string" || !UUID_PATTERN.test(entry));
      if (invalid) {
        errors.push(`${label} must contain only lowercase UUID strings.`);
      }
      break;
    }
    case "item_list": {
      if (!Array.isArray(value)) {
        errors.push(`${label} must be an array.`);
        break;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${label} must have at most ${rule.max} entries.`);
      }
      const missing = [];
      for (const entry of value) {
        if (!isPlainObject(entry)) {
          missing.push("an object");
          break;
        }
        for (const key of rule.items ?? []) {
          if (typeof entry[key] !== "string" || entry[key].trim() === "") {
            missing.push(key);
          }
        }
      }
      if (missing.length) {
        errors.push(`${label} entries must be objects with: ${[...new Set(missing)].join(", ")}.`);
      }
      break;
    }
    default:
      errors.push(`${label} has an unsupported field type.`);
  }

  return errors;
}

/**
 * Validate a style block against `SECTION_STYLE_FIELDS`.
 *
 * Returns `{ ok: true, style }` with the accepted style, or
 * `{ ok: false, errors }` where every error is a string of the form
 * `"style.<field> <problem>"`. An unknown style key is an error — a typo in
 * the admin form must be reported, never silently dropped.
 */
export function validateStyle(style) {
  if (style === undefined || style === null) {
    return { ok: true, style: {} };
  }
  if (!isPlainObject(style)) {
    return { ok: false, errors: ["style must be an object."] };
  }

  const errors = [];

  for (const [name, rule] of Object.entries(SECTION_STYLE_FIELDS)) {
    if (!Object.hasOwn(style, name)) continue;
    const value = style[name];
    if (isBlank(value)) continue;
    errors.push(...checkFieldValue("style", name, rule, value));
  }

  for (const name of Object.keys(style)) {
    if (!Object.hasOwn(SECTION_STYLE_FIELDS, name)) {
      errors.push(`style.${name} is not a known style field.`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, style: { ...style } };
}

/**
 * Validate one section.
 *
 * The section's `type` must be one of the twelve catalogue types — the lookup
 * uses `Object.hasOwn`, so a stored type of `"toString"` or `"__proto__"`
 * cannot reach a prototype member. Each declared field is checked against its
 * rule, and **an unknown key in `data` is an error**: an admin typo must be
 * reported, not swallowed.
 *
 * Returns `{ ok: true, data, style }` — the accepted values as they were
 * given, with absent optional fields left out — or `{ ok: false, errors }`
 * where every error is a string of the form `"<type>.<field> <problem>"`.
 */
export function validateSection(section) {
  if (!isPlainObject(section)) {
    return { ok: false, errors: ["section must be an object."] };
  }

  const type = typeof section.type === "string" ? section.type : "";
  if (!type || !Object.hasOwn(SECTION_TYPES, type)) {
    return { ok: false, errors: [`${type || "section"} is not a known section type.`] };
  }

  const rules = SECTION_TYPES[type].fields;
  const errors = [];

  let data = {};
  if (section.data !== undefined && section.data !== null) {
    if (!isPlainObject(section.data)) {
      errors.push(`${type}.data must be an object.`);
    } else {
      data = section.data;
    }
  }

  for (const [name, rule] of Object.entries(rules)) {
    const value = Object.hasOwn(data, name) ? data[name] : undefined;
    if (isBlank(value)) {
      if (rule.required) errors.push(`${type}.${name} is required.`);
      continue;
    }
    if (rule.required && Array.isArray(value) && value.length === 0) {
      errors.push(`${type}.${name} is required.`);
      continue;
    }
    errors.push(...checkFieldValue(type, name, rule, value));
  }

  for (const name of Object.keys(data)) {
    if (!Object.hasOwn(rules, name)) {
      errors.push(`${type}.${name} is not a known field.`);
    }
  }

  const styleResult = validateStyle(section.style);
  if (!styleResult.ok) errors.push(...styleResult.errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { ...data }, style: styleResult.style };
}

/** The placeholder shape for a section that cannot be used at all. */
function unknownSection() {
  return { id: null, type: "unknown", enabled: false, data: {}, style: {} };
}

/** Build the complete `data` block of one section from its rules. */
function normalizeData(type, source) {
  const rules = SECTION_TYPES[type].fields;
  const data = {};
  for (const [name, rule] of Object.entries(rules)) {
    const value = isPlainObject(source) && Object.hasOwn(source, name) ? source[name] : undefined;
    if (value === undefined) {
      data[name] = rule.default !== undefined ? rule.default : "";
      continue;
    }
    data[name] = value;
  }
  return data;
}

/** Build the complete `style` block of one section from the shared rules. */
function normalizeStyle(source) {
  const style = {};
  for (const [name, rule] of Object.entries(SECTION_STYLE_FIELDS)) {
    const value = isPlainObject(source) && Object.hasOwn(source, name) ? source[name] : undefined;
    style[name] = value === undefined ? (rule.default !== undefined ? rule.default : "") : value;
  }
  return style;
}

/**
 * Normalise a stored section list into the shape the renderer consumes.
 *
 * Every missing optional field is replaced by its rule default, every unknown
 * key is dropped, and the list is capped at `SECTION_MAX` entries. An entry
 * that is not an object with a known type becomes a placeholder
 * (`{ id: null, type: "unknown", enabled: false, data: {}, style: {} }`)
 * instead of being dropped, so the renderer can show something in its place.
 *
 * This function **never throws**: it is called on data that may have been
 * written by an older schema version.
 */
export function normalizeSections(sections) {
  try {
    const list = Array.isArray(sections) ? sections : isPlainObject(sections) ? [sections] : [];

    const normalized = [];
    for (const entry of list) {
      if (!isPlainObject(entry)) {
        normalized.push(unknownSection());
        continue;
      }
      const type = typeof entry.type === "string" ? entry.type : "";
      if (!type || !Object.hasOwn(SECTION_TYPES, type)) {
        normalized.push(unknownSection());
        continue;
      }
      normalized.push({
        id: typeof entry.id === "string" ? entry.id : null,
        type,
        enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
        data: normalizeData(type, entry.data),
        style: normalizeStyle(entry.style),
      });
      if (normalized.length >= SECTION_MAX) break;
    }
    return normalized;
  } catch {
    return [];
  }
}
