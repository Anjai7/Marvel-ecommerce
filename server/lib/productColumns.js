/**
 * The columns a product list needs, and the ones it does not.
 *
 * A product row is fat: the specifications, the user guide, the highlights,
 * the care instructions and the delivery info are JSON blobs that together
 * are most of the row. A card shows the title, the image, the price, the
 * rating and the stock — it never reads the blobs.
 *
 * Reading the whole row for a list of a thousand products moved nearly three
 * megabytes per request out of the database and into the browser, for
 * columns nobody looked at. The list reads what it uses; the single-product
 * read keeps everything.
 */

/** What a card, a listing or a table of products needs. */
export const PRODUCT_LIST_COLUMNS = [
  "id",
  "title",
  "price",
  "original_price",
  "image_url",
  "rating",
  "reviews_count",
  "stock",
  "category",
  "category_id",
  "is_featured",
  "offer_text",
  "sku",
  "vendor_name",
  "created_at",
  "description",
];

/** The same list, as the string the query takes. */
export const PRODUCT_LIST_SELECT = PRODUCT_LIST_COLUMNS.join(",");
