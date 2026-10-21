/**
 * Adapter from `GET /api/products/:id/details` to the product-page view model.
 *
 * Every value here is copied from the payload. When the API has nothing for a
 * field the field is `null` (or an empty array), never a made-up placeholder:
 * no default price, rating, review count, image, brand, SKU, colour, size,
 * EMI plan, bank offer, coupon, highlight, specification, dimension, material,
 * care instruction, certification, in-box item, delivery promise, warranty,
 * seller, user guide or review.
 */

/** A trimmed, non-empty string, or null. */
function text(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A finite number, or null. Accepts the numeric strings PostgREST returns. */
function amount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A JSONB column arrives parsed. Older rows may store JSON as a string, so a
 * string that clearly holds JSON is parsed; anything else is returned as-is.
 */
function jsonValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/** A list of display strings from a JSONB column holding strings or objects. */
export function textList(value) {
  const data = jsonValue(value);
  if (data === null || data === undefined) return [];
  const rows = Array.isArray(data) ? data : [data];
  return rows
    .map((row) => {
      if (typeof row === "string") return text(row);
      if (row && typeof row === "object") {
        return text(row.label ?? row.title ?? row.name ?? row.text ?? row.value);
      }
      return null;
    })
    .filter(Boolean);
}

/** `free_shipping` / `freeShipping` style lookup. */
function pick(source, ...keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

function labelFromKey(key) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function toPair(row) {
  if (!row || typeof row !== "object") return null;
  const label = text(row.label ?? row.name ?? row.key ?? row.title);
  const value = text(row.value ?? row.text ?? row.detail);
  return label && value ? { label, value } : null;
}

function toPairs(source) {
  const data = jsonValue(source);
  if (!data) return [];
  if (Array.isArray(data)) return data.map(toPair).filter(Boolean);
  if (typeof data !== "object") return [];
  return Object.entries(data)
    .map(([key, value]) => {
      const rendered = text(value);
      return rendered ? { label: labelFromKey(key), value: rendered } : null;
    })
    .filter(Boolean);
}

/** `specifications` JSONB → `[{ category, items: [{ label, value }] }]`. */
export function specificationGroups(value) {
  const data = jsonValue(value);
  if (!data) return [];

  const looksGrouped =
    Array.isArray(data) &&
    data.some((row) => row && typeof row === "object" && Array.isArray(row.items));
  if (looksGrouped) {
    return data
      .map((group) => ({
        category: text(group.category ?? group.title ?? group.name),
        items: toPairs(group.items),
      }))
      .filter((group) => group.items.length > 0);
  }

  const items = toPairs(data);
  return items.length > 0 ? [{ category: null, items }] : [];
}

/** `dimensions` JSONB → `[{ label, value }]`. */
export function dimensionRows(value) {
  return toPairs(value);
}

/** `materials` JSONB → `[{ part, material }]`. */
export function materialRows(value) {
  const data = jsonValue(value);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (typeof row === "string") return { part: null, material: text(row) };
      if (!row || typeof row !== "object") return null;
      const part = text(row.part ?? row.label ?? row.name);
      const material = text(row.material ?? row.value ?? row.text);
      return part || material ? { part, material } : null;
    })
    .filter(Boolean)
    .filter((row) => row.material);
}

/**
 * `delivery_info` JSONB → `{ estimatedDays, lines }`.
 *
 * `lines` holds only the promises the stored value actually makes. Nothing is
 * assumed when the column is empty.
 */
export function deliverySummary(value) {
  const data = jsonValue(value);
  if (!data) return { estimatedDays: null, lines: [] };

  if (Array.isArray(data)) {
    return { estimatedDays: null, lines: textList(data) };
  }
  if (typeof data !== "object") return { estimatedDays: null, lines: [] };

  const estimatedDays = text(pick(data, "estimated_days", "estimatedDays", "eta", "delivery_time"));
  const lines = [];

  if (pick(data, "free_shipping", "freeShipping") === true) lines.push("Free shipping");
  if (pick(data, "express_available", "expressAvailable") === true) {
    lines.push("Express delivery available");
  }

  const returnDays = amount(pick(data, "return_days", "returnDays"));
  if (returnDays !== null) lines.push(`${returnDays}-day returns`);
  else if (pick(data, "returns") === true) lines.push("Returns accepted");

  lines.push(...textList(pick(data, "notes", "lines", "details")));

  return { estimatedDays, lines };
}

/** `user_guide` JSONB → `{ url, version, fileSize, steps }`, or null. */
export function userGuideDetails(value) {
  const data = jsonValue(value);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const url = text(pick(data, "url", "pdf_url", "file_url", "href"));
  const version = text(pick(data, "version", "manual_version", "manualVersion"));
  const fileSize = text(pick(data, "file_size", "fileSize", "size"));
  const steps = (Array.isArray(data.steps) ? data.steps : [])
    .map((step, index) => {
      if (typeof step === "string") {
        return text(step) ? { step: index + 1, title: text(step), desc: null } : null;
      }
      if (!step || typeof step !== "object") return null;
      const title = text(step.title ?? step.name ?? step.label);
      const desc = text(step.desc ?? step.description ?? step.text);
      if (!title && !desc) return null;
      return { step: amount(step.step) ?? index + 1, title, desc };
    })
    .filter(Boolean);

  if (!url && !version && !fileSize && steps.length === 0) return null;
  return { url, version, fileSize, steps };
}

/** Offers from the API grouped by `kind`, preserving the server's order. */
export function groupOffers(offers) {
  const groups = { emi: [], bank: [], coupon: [] };
  if (!Array.isArray(offers)) return groups;

  for (const offer of offers) {
    if (!offer || typeof offer !== "object") continue;
    const kind = offer.kind;
    if (!Object.hasOwn(groups, kind)) continue;
    groups[kind].push({
      title: text(offer.title),
      bank: text(offer.bank),
      code: text(offer.code),
      description: text(offer.description),
      months: amount(offer.months),
      amount: amount(offer.amount),
      interest: text(offer.interest),
    });
  }
  return groups;
}

/** Stored reviews → summary with one row per star that occurs. */
export function reviewSummary(reviews) {
  const source = reviews && typeof reviews === "object" ? reviews : {};
  const total = amount(source.total) ?? 0;
  const overall = amount(source.overall);
  const raw = source.breakdown && typeof source.breakdown === "object" ? source.breakdown : {};

  const breakdown = Object.entries(raw)
    .map(([stars, count]) => ({ stars: Number(stars), count: amount(count) ?? 0 }))
    .filter((row) => Number.isInteger(row.stars) && row.stars >= 1 && row.stars <= 5)
    .map((row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.stars - a.stars);

  return { overall, total, breakdown };
}

function mapMedia(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const url = text(item.url);
      if (!url) return null;
      return {
        id: item.id ?? null,
        url,
        type: "image",
        thumb: url,
        kind: text(item.kind),
      };
    })
    .filter(Boolean);
}

function mapColors(colors) {
  if (!Array.isArray(colors)) return [];
  return colors
    .map((color) => {
      const label = text(color?.label ?? color?.name);
      return label ? { id: color.id ?? null, label, value: text(color.value) } : null;
    })
    .filter(Boolean);
}

function mapSizes(sizes) {
  if (!Array.isArray(sizes)) return [];
  return sizes
    .map((size) => {
      const label = text(size?.label ?? size?.name);
      return label ? { id: size.id ?? null, label, value: text(size.value) } : null;
    })
    .filter(Boolean);
}

function sellerFrom(product) {
  const name = text(product.vendor_name ?? product.seller_name ?? product.store_name);
  return name ? { name } : null;
}

function manufacturerFrom(product) {
  const manufacturer = {
    name: text(product.manufacturer_name),
    importedBy: text(product.importer_packer),
    manufacturingDate: text(product.manufacturing_date),
    address: text(product.manufacturer_address),
    supportPhone: text(product.support_phone),
    supportEmail: text(product.support_email),
  };
  return Object.values(manufacturer).some(Boolean) ? manufacturer : null;
}

/**
 * Shape one details payload for the product page.
 *
 * @param {{ product?: object, offers?: object[], reviews?: object,
 *   variants?: { colors?: object[], sizes?: object[] }, media?: object[] }} payload
 * @returns {object|null} null when there is no product row to show
 */
export function buildDynamicProductDetails(payload) {
  const product = payload?.product;
  if (!product || typeof product !== "object" || product.id === undefined) return null;
  const price = amount(product.price);
  const originalPrice = amount(product.original_price ?? product.originalPrice);
  const discountPercent =
    price !== null && originalPrice !== null && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;
  const stock = amount(product.stock);
  const offers = groupOffers(payload?.offers);

  const media = mapMedia(payload?.media);
  const primaryImage = text(product.image_url ?? product.image);
  if (media.length === 0 && primaryImage) {
    media.push({ id: null, url: primaryImage, type: "image", thumb: primaryImage, kind: "hero" });
  }

  return {
    id: product.id,
    name: text(product.title ?? product.name),
    brand: text(product.brand),
    sku: text(product.sku),
    category: text(product.category),
    description: text(product.description),

    price,
    originalPrice,
    discountPercent,
    inStock: stock === null ? null : stock > 0,
    stock,
    featured: product.is_featured === true,

    offerText: text(product.offer_text),
    offerEndsAt: text(product.offer_ends_at),
    warranty: text(product.warranty),

    media,
    image: media[0]?.url ?? null,
    colors: mapColors(payload?.variants?.colors),
    sizes: mapSizes(payload?.variants?.sizes),

    highlights: textList(product.highlights),
    specifications: specificationGroups(product.specifications),
    dimensions: dimensionRows(product.dimensions),
    materials: materialRows(product.materials),
    careInstructions: textList(product.care_instructions),
    certifications: textList(product.certifications),
    inBox: textList(product.in_box),

    deliveryInfo: deliverySummary(product.delivery_info),
    userGuide: userGuideDetails(product.user_guide),
    manufacturer: manufacturerFrom(product),

    offers,
    reviewSummary: reviewSummary(payload?.reviews),
    seller: sellerFrom(product),

    additionalDetails: {
      modelNumber: text(product.model_name),
      countryOfOrigin: text(product.country_of_origin),
      hsn: text(product.hsn_code ?? product.hsn),
      gst: text(product.gst_rate ?? product.gst),
    },
  };
}

export default buildDynamicProductDetails;
