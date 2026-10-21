/**
 * Currency for the storefront.
 *
 * Every amount the app shows — product prices, cart totals, order values, the
 * admin revenue figures and the chart axes — goes through this module, so no
 * screen can drift back to a hand-written symbol.
 *
 * The backend owns the live values: `GET /api/settings` carries
 * `currency: { code, symbol, locale }` and `SettingsContext` calls
 * `configureCurrency()` as soon as that request resolves. The original
 * INR / ₹ / en-IN values stay as the fallback for anything rendered before the
 * settings arrive (or when the settings endpoint has no currency row).
 */

const FALLBACK = Object.freeze({ code: "INR", symbol: "₹", locale: "en-IN" });

/** The ISO currency code. Live binding: `configureCurrency` reassigns it. */
export let CURRENCY = FALLBACK.code;

/** The symbol shown next to every amount. Live binding. */
export let CURRENCY_SYMBOL = FALLBACK.symbol;

/** The locale used for digit grouping. Live binding. */
export let CURRENCY_LOCALE = FALLBACK.locale;

/** A non-empty trimmed string, or `null` so the caller can fall back. */
function readText(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Point the module at the backend's currency. Called by `SettingsProvider`
 * whenever the settings load (and again on every refresh).
 *
 * A missing or malformed value falls back per field rather than freezing a
 * half-configured currency, so formatting can never throw. Pass nothing (or
 * `null`) to restore the INR default.
 *
 * @param {{ code?: string, symbol?: string, locale?: string } | null | undefined} next
 */
export function configureCurrency(next) {
  const currency = next && typeof next === "object" && !Array.isArray(next) ? next : {};
  CURRENCY = readText(currency.code) ?? FALLBACK.code;
  CURRENCY_SYMBOL = readText(currency.symbol) ?? FALLBACK.symbol;
  CURRENCY_LOCALE = readText(currency.locale) ?? FALLBACK.locale;
}

/**
 * Format an amount with the live symbol.
 *
 * @param {number|string} value the amount; a numeric string (what a database
 *   numeric column returns) is accepted.
 * @param {{ decimals?: number }} [options] `decimals: 0` for chart axes and
 *   other tight spaces.
 * @returns {string} for example "₹1,23,456.75"
 */
export function formatCurrency(value, options = {}) {
  return CURRENCY_SYMBOL + formatAmount(value, options);
}

/**
 * Format an amount without the symbol, for a screen that draws the symbol
 * itself (the revenue KPI card sets a large glyph next to the number).
 *
 * @returns {string} for example "1,23,456.75"
 */
export function formatAmount(value, options = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  const decimals = Number.isFinite(Number(options.decimals)) ? Number(options.decimals) : 2;
  const formatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, Math.min(2, decimals)),
  };

  try {
    return amount.toLocaleString(CURRENCY_LOCALE, formatOptions);
  } catch {
    // A malformed locale from the backend must not break every price on the
    // page — fall back to the original locale.
    return amount.toLocaleString(FALLBACK.locale, formatOptions);
  }
}
