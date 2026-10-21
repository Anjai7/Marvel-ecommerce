// Settings endpoint only — transport lives in client.js, which already
// prefixes `/api`, so paths here are relative to it.
import { apiFetch } from "./client.js";

/** `{ settings: { <key>: <stored JSON value> } }` — missing keys are omitted. */
export const apiFetchSettings = () => apiFetch("/settings");

/**
 * Save settings. The body is a flat `key -> value` map; a `null` value removes
 * the row, so an optional block can be turned off.
 */
export const apiUpdateSettings = (settings) =>
  apiFetch("/settings", { method: "PUT", body: { settings } });
