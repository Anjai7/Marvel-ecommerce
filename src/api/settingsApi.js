// Settings endpoint only — transport lives in client.js, which already
// prefixes `/api`, so paths here are relative to it.
import { apiFetch } from "./client.js";

/** `{ settings: { <key>: <stored JSON value> } }` — missing keys are omitted. */
export const apiFetchSettings = () => apiFetch("/settings");
