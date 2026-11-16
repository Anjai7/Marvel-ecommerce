import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { clearCache } from "../../server/lib/shortCache.js";

/**
 * The catalogue cache lives in the API's memory so a page view does not
 * pay for the catalogue. A test that runs after another would otherwise
 * read the first one's answer, so every test starts with an empty cache.
 */
beforeEach(() => {
  clearCache();
});
