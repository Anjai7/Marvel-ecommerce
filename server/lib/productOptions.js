/**
 * The option kinds a product may carry.
 *
 * An **option** is one axis of choice (`color`, `size`, `capacity`…), a
 * **value** is one choice on that axis (`Blue`, `XL`, `256 GB`), and a
 * **variant** is one sellable combination of values with its own price, stock
 * and SKU. The contract for all of it lives in
 * `docs/product-variants-contract.md`.
 *
 * The same list is duplicated in `src/lib/productOptions.js` for the admin UI,
 * and `src/lib/productOptions.test.js` asserts that the two copies stay
 * identical: a kind the server rejects but the admin offers is a dead end for
 * the user, and a kind the server accepts but the admin cannot offer is a row
 * nobody can create.
 *
 * Dependency-free on purpose — the admin bundle, the API and the tests all
 * import it, and it must not drag anything in with it.
 */

/** The allowed kinds, in the order the admin UI lists them. */
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

/**
 * What the customer reads for each kind. `color` is "Colour" and not "Color"
 * because the label is storefront copy, not a database value.
 */
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
