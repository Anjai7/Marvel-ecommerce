/* The console's Settings screen.
 *
 * It edits the `site_settings` rows the whole storefront reads: the store
 * details, the shipping thresholds, the currency, the footer chrome, the trust
 * promises and the hero's rescue slide. Saving goes through
 * `PUT /api/settings`, so the values are in the database, not in a component.
 *
 * Nothing here is hardcoded: every field starts from what the API returned.
 * A field the API has no value for is blank, and saving a blank optional
 * field removes the row rather than storing an empty string. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { apiFetchSettings, apiUpdateSettings } from "../../api/settingsApi";
import { Button, Input, useToast } from "../ui";

/** Read `a.b.c` out of an object. */
const readPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);

/** Write `a.b.c` into an object, creating the objects on the way. */
const writePath = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = object;
  for (const key of keys) {
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[last] = value;
  return object;
};

/** The editable fields, grouped. `json: true` means the value is edited as JSON. */
const FIELDS = [
  {
    group: "Store",
    rows: [
      { path: "store.name", label: "Store name" },
      { path: "store.tagline", label: "Tagline" },
      { path: "store.description", label: "Description", type: "textarea" },
      { path: "store.country", label: "Country" },
      { path: "store.support_email", label: "Support email" },
      { path: "store.support_phone", label: "Support phone" },
    ],
  },
  {
    group: "Shipping & inventory",
    rows: [
      { path: "shipping.free_threshold", label: "Free shipping over", type: "number" },
      { path: "shipping.standard_days", label: "Standard delivery" },
      { path: "shipping.return_days", label: "Return window (days)", type: "number" },
      { path: "shipping.express_available", label: "Express delivery offered", type: "checkbox" },
      { path: "inventory.low_stock_threshold", label: "Low stock at or below", type: "number" },
    ],
  },
  {
    group: "Currency",
    rows: [
      { path: "currency.code", label: "ISO code" },
      { path: "currency.symbol", label: "Symbol" },
      { path: "currency.locale", label: "Locale" },
    ],
  },
  {
    group: "Footer",
    rows: [
      { path: "footer.copyright", label: "Copyright" },
      { path: "footer.security_note", label: "Security note" },
      { path: "footer.brand_logo", label: "Logo path" },
      { path: "footer.brand_alt", label: "Logo alt text" },
      { path: "footer.payment_methods", label: "Payment methods", type: "list" },
      { path: "footer.value_props", label: "Value props", type: "json" },
      { path: "footer.socials", label: "Social links", type: "json" },
    ],
  },
  {
    group: "Trust promises",
    rows: [{ path: "trust.promises", label: "Promises", type: "json" }],
  },
  {
    group: "Hero rescue slide",
    rows: [
      { path: "hero_fallback.badge", label: "Badge" },
      { path: "hero_fallback.title", label: "Title" },
      { path: "hero_fallback.subtitle", label: "Subtitle", type: "textarea" },
      { path: "hero_fallback.btn_text", label: "Button text" },
      { path: "hero_fallback.btn_path", label: "Button path" },
      { path: "hero_fallback.bg_gradient", label: "Background gradient" },
    ],
  },
];

/** Every path the screen edits, so a save only sends what changed. */
const ALL_PATHS = FIELDS.flatMap((group) => group.rows.map((row) => row.path));

/** Render a stored value as the text an input holds. */
const toText = (value, type) => {
  if (value === null || value === undefined) return "";
  if (type === "json") return JSON.stringify(value, null, 2);
  if (type === "list") return Array.isArray(value) ? value.join(", ") : String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export default function SettingsEditor() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetchSettings();
      const current = data?.settings ?? {};
      setSettings(current);
      setDraft(current);
    } catch (err) {
      setError(err.message || "Could not load the settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    return ALL_PATHS.some((path) => {
      const before = toText(readPath(settings, path), fieldType(path));
      const after = toText(readPath(draft, path), fieldType(path));
      return before !== after;
    });
  }, [settings, draft]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {};
      for (const group of FIELDS) {
        for (const row of group.rows) {
          const raw = readPath(draft, row.path);
          if (row.type === "json") {
            const text = String(raw ?? "").trim();
            if (text === "") {
              patch[row.path] = null;
              continue;
            }
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              throw new Error(`"${row.label}" is not valid JSON.`);
            }
            writePath(patch, row.path, parsed);
            continue;
          }
          if (row.type === "list") {
            const list = String(raw ?? "")
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean);
            writePath(patch, row.path, list.length > 0 ? list : null);
            continue;
          }
          if (row.type === "number") {
            const number = Number(raw);
            writePath(patch, row.path, raw === "" || !Number.isFinite(number) ? null : number);
            continue;
          }
          if (row.type === "checkbox") {
            writePath(patch, row.path, Boolean(raw));
            continue;
          }
          const text = String(raw ?? "").trim();
          writePath(patch, row.path, text === "" ? null : text);
        }
      }

      const saved = await apiUpdateSettings(patch);
      const current = saved?.settings ?? {};
      setSettings(current);
      setDraft(current);
      addToast({
        title: "Settings Saved",
        message: "The storefront now reads the new values.",
        type: "success",
      });
    } catch (err) {
      setError(err.message || "Could not save the settings.");
      addToast({ title: "Save Failed", message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="chart-subtitle" style={{ padding: "12px 4px" }}>
        <Loader2 size={14} className="spin-animation" /> Loading settings...
      </p>
    );
  }

  return (
    <div className="settings-editor">
      <div className="admin-page-header">
        <div className="admin-page-heading">
          <div>
            <h2 className="admin-page-title">Settings</h2>
            <p className="admin-page-subtitle">
              The store's own configuration — every value here is read by the storefront.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="form-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {FIELDS.map((group) => (
        <section key={group.group} className="settings-group">
          <h3 className="settings-group-title">{group.group}</h3>
          <div className="settings-group-grid">
            {group.rows.map((row) => {
              const value = readPath(draft, row.path);
              const id = `settings-${row.path.replace(/\./g, "-")}`;
              if (row.type === "checkbox") {
                return (
                  <label key={row.path} className="settings-checkbox" htmlFor={id}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) =>
                        setDraft((previous) =>
                          writePath({ ...previous }, row.path, event.target.checked)
                        )
                      }
                    />
                    <span>{row.label}</span>
                  </label>
                );
              }
              if (row.type === "textarea" || row.type === "json") {
                return (
                  <div key={row.path} className="form-group settings-field settings-field-wide">
                    <label className="form-label" htmlFor={id}>
                      {row.label}
                    </label>
                    {row.type === "json" ? (
                      <textarea
                        id={id}
                        className="settings-textarea settings-textarea-code"
                        rows={6}
                        spellCheck={false}
                        value={toText(value, row.type)}
                        onChange={(event) =>
                          setDraft((previous) =>
                            writePath({ ...previous }, row.path, event.target.value)
                          )
                        }
                      />
                    ) : (
                      <textarea
                        id={id}
                        className="settings-textarea"
                        rows={3}
                        value={toText(value, row.type)}
                        onChange={(event) =>
                          setDraft((previous) =>
                            writePath({ ...previous }, row.path, event.target.value)
                          )
                        }
                      />
                    )}
                  </div>
                );
              }
              return (
                <div key={row.path} className="form-group settings-field">
                  <label className="form-label" htmlFor={id}>
                    {row.label}
                  </label>
                  <Input
                    id={id}
                    type={row.type === "number" ? "number" : "text"}
                    value={toText(value, row.type)}
                    onChange={(event) =>
                      setDraft((previous) =>
                        writePath({ ...previous }, row.path, event.target.value)
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="settings-actions">
        <Button type="button" variant="outline" onClick={load} disabled={saving}>
          <RotateCcw size={15} /> Revert
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 size={15} className="spin-animation" /> : <Save size={15} />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

/** The input type of a path, looked up from the field table. */
function fieldType(path) {
  for (const group of FIELDS) {
    for (const row of group.rows) {
      if (row.path === path) return row.type;
    }
  }
  return "text";
}
