/**
 * Currency for a platform that is India-only.
 *
 * Every amount the app shows — product prices, cart totals, order values, the
 * admin revenue figures and the chart axes — is in Indian rupees. This module
 * owns the symbol, the locale and the grouping so no screen can drift back to
 * dollars: import `formatCurrency` instead of writing a symbol by hand.
 */

/** The ISO currency code. */
export const CURRENCY = "INR";

/** The symbol shown next to every amount. */
export const CURRENCY_SYMBOL = "₹";

/** `en-IN` groups digits the Indian way: 1,23,456.75. */
export const CURRENCY_LOCALE = "en-IN";

/**
 * Format an amount as rupees.
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
  return amount.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, Math.min(2, decimals)),
  });
}
