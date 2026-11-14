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
