/**
 * The option kinds a product may carry — the same eight the server accepts,
 * in the same order. `src/lib/productOptions.test.js` asserts that the two
 * copies stay identical.
 */
export const OPTION_KINDS = [
  "color",
  "size",
  "capacity",
  "storage",
  "material",
  "style",
  "weight",
  "flavour",
];

export const OPTION_KIND_LABELS = {
  color: "Colour",
  size: "Size",
  capacity: "Capacity",
  storage: "Storage",
  material: "Material",
  style: "Style",
  weight: "Weight",
  flavour: "Flavour",
};

/** True for a kind the catalogue accepts; anything else is rejected. */
export function isOptionKind(kind) {
  return OPTION_KINDS.includes(kind);
}

/**
 * The customer's choice for one item, as one line of readable text:
 * "Colour: Blue · Size: M".
 *
 * The cart, the order, the customer's order list and the vendor's order
 * list all show the same thing, so they all read it the same way. An item
 * with no choice carries none, and an option without a label falls back to
 * its value — a hex colour is dropped, because it is not something a person
 * can read.
 */
export function formatOptionChoices(options) {
  if (!Array.isArray(options)) return "";
  const parts = [];
  for (const option of options) {
    if (!option || typeof option !== "object") continue;
    const kind = typeof option.kind === "string" ? option.kind.trim().toLowerCase() : "";
    const label = [option.label, option.value]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => candidate && !candidate.startsWith("#"));
    if (!label) continue;
    const axis = OPTION_KIND_LABELS[kind];
    parts.push(axis ? `${axis}: ${label}` : label);
  }
  return parts.join(" · ");
}

/**
 * The same choice, short: "Blue / M" — one quiet line per item.
 *
 * Used where the full reading would crowd the row, with the full reading
 * in the tooltip.
 */
export function formatOptionValues(options) {
  if (!Array.isArray(options)) return "";
  const parts = [];
  for (const option of options) {
    if (!option || typeof option !== "object") continue;
    const label = [option.label, option.value]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => candidate && !candidate.startsWith("#"));
    if (label) parts.push(label);
  }
  return parts.join(" / ");
}
