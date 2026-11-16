/**
 * A short-lived cache for the reads the storefront makes on every page.
 *
 * The catalogue changes a few times a day; the storefront asks for it on
 * every page view. Without a cache each view pulls the whole catalogue out
 * of the database and sends it on — which is the difference between a few
 * megabytes a day and a few megabytes a minute on a free tier.
 *
 * The cache is in the API's memory: it is a cache, not a store. A restart
 * empties it, and an entry lives for at most its TTL.
 */

/** How long a catalogue read is kept, in milliseconds. */
export const CATALOGUE_TTL_MS = 60 * 1000;

const entries = new Map();

/**
 * The value for `key`, loaded with `loader` when it is missing or stale.
 *
 * The loader is only called when the cache misses, so a hit costs nothing
 * on the database. A load that fails is not cached — the next request tries
 * again rather than remembering the failure.
 */
export async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expires > now) {
    return hit.value;
  }

  const value = await loader();
  entries.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Drop every cached read. Used when the catalogue is written. */
export function clearCache() {
  entries.clear();
}

/** How many entries are held — for the tests and for the console. */
export function cacheSize() {
  return entries.size;
}
