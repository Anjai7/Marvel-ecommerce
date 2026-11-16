/**
 * The shared look of the console's charts.
 *
 * The charts are the one place where a style cannot be a class: Recharts
 * takes its colours and its type sizes as props. Putting them here means
 * the axis of every chart is drawn the same way and a change to one of
 * them changes all of them — instead of the same hex being written into
 * seven files.
 *
 * The palette follows the app's tokens: the same navy the buttons use, the
 * same green, amber and red the status pills use.
 */

/** The type and colour of an axis. */
export const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

/** The series colours, by what they mean. */
export const CHART_COLORS = {
  navy: "#2874f0",
  indigo: "#6366f1",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#a855f7",
  slate: "#94a3b8",
};

/** The colour of a stock state — the same words the status pills use. */
export const STOCK_COLORS = {
  inStock: CHART_COLORS.green,
  lowStock: CHART_COLORS.amber,
  outOfStock: CHART_COLORS.red,
};
