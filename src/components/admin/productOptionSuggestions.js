/**
 * What each category usually varies by.
 *
 * The admin console offers these as one-click suggestions: the admin picks a
 * category, sees the kinds and values that category usually uses, and adds a
 * whole option block in one click. They are only ever a starting point — every
 * value can be edited, removed or ignored, and the admin can always build the
 * options their own way.
 *
 * The keys are the category names this store actually uses, lowercased
 * ("Electronics" → "electronics", "Home & Kitchen" → "home & kitchen"). A few
 * near-synonyms are kept as aliases so a slightly different name still finds
 * the right table.
 *
 * Only the kinds in `OPTION_KINDS` may appear here — the storefront and the
 * server both validate against that list.
 */

/** The kind lists are shared so a category table never drifts from another. */
const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CLOTHING_COLOURS = ["Black", "White", "Navy", "Olive", "Red"];
const NEUTRAL_COLOURS = ["Black", "White", "Blue", "Red"];

/**
 * The category → kinds → values table.
 *
 * Each entry is `{ label, options }`, where `label` is the category's display
 * name and `options` is the list of `{ kind, values }` blocks the admin can
 * add in one click.
 */
export const CATEGORY_OPTION_SUGGESTIONS = {
  apparel: {
    label: "Apparel",
    options: [
      { kind: "size", values: CLOTHING_SIZES },
      { kind: "color", values: CLOTHING_COLOURS },
    ],
  },
  fashion: {
    label: "Fashion",
    options: [
      { kind: "size", values: CLOTHING_SIZES },
      { kind: "color", values: CLOTHING_COLOURS },
      { kind: "material", values: ["Cotton", "Polyester", "Denim", "Linen"] },
    ],
  },
  footwear: {
    label: "Footwear",
    options: [
      {
        kind: "size",
        values: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "EU 38", "EU 39", "EU 40", "EU 41"],
      },
      { kind: "color", values: ["Black", "Brown", "White", "Tan", "Navy"] },
    ],
  },
  electronics: {
    label: "Electronics",
    options: [
      { kind: "storage", values: ["64GB", "128GB", "256GB", "512GB"] },
      { kind: "color", values: ["Black", "White", "Silver", "Space Grey", "Blue"] },
      { kind: "capacity", values: ["1TB", "2TB", "4TB"] },
    ],
  },
  mobiles: {
    label: "Mobiles",
    options: [
      { kind: "storage", values: ["64GB", "128GB", "256GB", "512GB"] },
      { kind: "color", values: ["Midnight", "Starlight", "Blue", "Gold"] },
      { kind: "capacity", values: ["5000mAh", "6000mAh", "7000mAh"] },
    ],
  },
  computers: {
    label: "Computers",
    options: [
      { kind: "storage", values: ["256GB", "512GB", "1TB", "2TB"] },
      { kind: "color", values: ["Silver", "Space Grey", "Midnight"] },
      { kind: "weight", values: ["1.2kg", "1.8kg", "2.4kg"] },
    ],
  },
  accessories: {
    label: "Accessories",
    options: [
      { kind: "color", values: NEUTRAL_COLOURS },
      { kind: "material", values: ["Leather", "Canvas", "Polyester", "Metal"] },
    ],
  },
  watches: {
    label: "Watches",
    options: [
      { kind: "color", values: ["Black", "Silver", "Rose Gold", "Blue"] },
      { kind: "style", values: ["Classic", "Sport", "Luxury", "Smart"] },
      { kind: "material", values: ["Stainless Steel", "Leather", "Silicone"] },
    ],
  },
  "home & kitchen": {
    label: "Home & Kitchen",
    options: [
      { kind: "capacity", values: ["1L", "2L", "5L"] },
      { kind: "color", values: ["White", "Black", "Stainless Steel", "Silver"] },
    ],
  },
  bedding: {
    label: "Bedding",
    options: [
      { kind: "size", values: ["Single", "Double", "King", "Queen"] },
      { kind: "color", values: ["White", "Grey", "Navy", "Pink"] },
      { kind: "material", values: ["Cotton", "Linen", "Polyester"] },
    ],
  },
  beauty: {
    label: "Beauty",
    options: [
      { kind: "size", values: ["50ml", "100ml", "200ml"] },
      { kind: "flavour", values: ["Rose", "Lavender", "Sandalwood", "Citrus", "Aloe Vera"] },
    ],
  },
  books: {
    label: "Books",
    options: [
      { kind: "style", values: ["Paperback", "Hardcover", "EPUB"] },
      { kind: "weight", values: ["200g", "400g", "800g"] },
    ],
  },
  sports: {
    label: "Sports",
    options: [
      { kind: "size", values: ["S", "M", "L", "XL"] },
      { kind: "color", values: ["Black", "Red", "Blue", "Green"] },
      { kind: "weight", values: ["250g", "500g", "1kg"] },
    ],
  },
  toys: {
    label: "Toys",
    options: [
      { kind: "color", values: ["Red", "Blue", "Yellow", "Green"] },
      { kind: "size", values: ["Small", "Medium", "Large"] },
    ],
  },
  "toys & games": {
    label: "Toys & Games",
    options: [
      { kind: "color", values: ["Red", "Blue", "Yellow", "Green"] },
      { kind: "size", values: ["Small", "Medium", "Large"] },
    ],
  },
  jewellery: {
    label: "Jewellery",
    options: [
      { kind: "color", values: ["Gold", "Silver", "Rose Gold"] },
      { kind: "size", values: ["16", "18", "20", "22"] },
      { kind: "material", values: ["Gold", "Silver", "Platinum"] },
    ],
  },
  furniture: {
    label: "Furniture",
    options: [
      { kind: "color", values: ["Brown", "Black", "White", "Grey"] },
      { kind: "material", values: ["Teak", "Sheesham", "Fabric", "Metal"] },
      { kind: "size", values: ["Small", "Medium", "Large"] },
    ],
  },
  groceries: {
    label: "Groceries",
    options: [
      { kind: "weight", values: ["250g", "500g", "1kg"] },
      { kind: "flavour", values: ["Classic", "Chocolate", "Vanilla", "Strawberry"] },
    ],
  },
  stationery: {
    label: "Stationery",
    options: [
      { kind: "color", values: NEUTRAL_COLOURS },
      { kind: "style", values: ["Fine Tip", "Ballpoint", "Gel", "Marker"] },
    ],
  },
};

/**
 * The suggestions used when the category is unknown.
 *
 * Colour and size are the two axes nearly every product has, so they are the
 * safest thing to offer before the admin narrows it down.
 */
export const DEFAULT_OPTION_SUGGESTIONS = {
  label: "General",
  options: [
    { kind: "color", values: ["Black", "White", "Blue", "Red"] },
    { kind: "size", values: ["Small", "Medium", "Large"] },
  ],
};

/**
 * The names the store uses for the same category, so "Shoes" finds the
 * footwear table and "Smartphones" finds the mobiles one.
 */
const CATEGORY_ALIASES = {
  shoes: "footwear",
  sneakers: "footwear",
  "sports shoes": "footwear",
  smartphones: "mobiles",
  phones: "mobiles",
  tablets: "mobiles",
  laptops: "computers",
  "laptops & pcs": "computers",
  pcs: "computers",
  kitchen: "home & kitchen",
  "home appliances": "home & kitchen",
  "kitchen appliances": "home & kitchen",
  cosmetics: "beauty",
  "personal care": "beauty",
  jewelry: "jewellery",
  grocery: "groceries",
  "toys and games": "toys & games",
  fitness: "sports",
  gym: "sports",
  "home furnishing": "furniture",
  sportswear: "sports",
};

/** Lowercase, "&" → "and", punctuation out, spaces collapsed. */
function normalizeCategory(category) {
  return String(category ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The table with its aliases folded in, keyed by the normalized name, so a
 * lookup is one map hit instead of a scan.
 */
const NORMALIZED_SUGGESTIONS = Object.entries(CATEGORY_OPTION_SUGGESTIONS).reduce(
  (table, [name, suggestion]) => {
    table[normalizeCategory(name)] = suggestion;
    return table;
  },
  {}
);

for (const [alias, target] of Object.entries(CATEGORY_ALIASES)) {
  const key = normalizeCategory(alias);
  if (NORMALIZED_SUGGESTIONS[key]) continue;
  const suggestion = NORMALIZED_SUGGESTIONS[normalizeCategory(target)];
  if (suggestion) NORMALIZED_SUGGESTIONS[key] = suggestion;
}

/**
 * The suggestions for a category, matched loosely.
 *
 * "Home & Kitchen" finds the home & kitchen table, "Home & Kitchen
 * Appliances" finds it too (the longest matching name wins), and anything
 * unrecognised falls back to the general colour/size suggestions.
 *
 * @param {string|null|undefined} category the product's category name
 * @returns {{ label: string, options: Array<{ kind: string, values: string[] }> }}
 */
export function getCategorySuggestions(category) {
  const key = normalizeCategory(category);
  if (!key) return DEFAULT_OPTION_SUGGESTIONS;

  const exact = NORMALIZED_SUGGESTIONS[key];
  if (exact) return exact;

  const names = Object.keys(NORMALIZED_SUGGESTIONS).sort(
    (left, right) => right.length - left.length
  );

  // "Electronics > Mobiles" is an electronics product first.
  const prefix = names.find((name) => key.startsWith(name));
  if (prefix) return NORMALIZED_SUGGESTIONS[prefix];

  // "Mobiles and tablets" contains a known name.
  const contained = names.find((name) => key.includes(name));
  if (contained) return NORMALIZED_SUGGESTIONS[contained];

  return DEFAULT_OPTION_SUGGESTIONS;
}

export default CATEGORY_OPTION_SUGGESTIONS;
