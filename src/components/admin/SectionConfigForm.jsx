import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "../ui";
import { ImageField } from "./ContentEditorKit";
import {
  SECTION_STYLE_FIELDS,
  SECTION_TYPES,
  validateSection,
} from "../../../server/lib/sectionTypes.js";

/**
 * The generated form for one section.
 *
 * The form is **derived**, never written by hand: it reads
 * `SECTION_TYPES[type].fields` and renders one control per field. Adding a
 * section type to the catalogue therefore never requires editing this file —
 * the catalogue is the single source of truth for what a section may hold.
 *
 * The shared layout block is derived the same way, from
 * `SECTION_STYLE_FIELDS`, because every section carries the same style.
 *
 * The same catalogue drives the validation: the rules are checked with the
 * server's own `validateSection`, so a field the form does not know about is
 * **reported** rather than silently dropped. An admin typo has to be visible.
 */

/**
 * The tokens that keep their capitals in a derived label.
 *
 * `cta_label` reads "CTA Label", not "Cta Label"; `image_url` reads
 * "Image URL". The map is keyed by the lowercase token.
 */
const ACRONYMS = new Map([
  ["api", "API"],
  ["cta", "CTA"],
  ["faq", "FAQ"],
  ["html", "HTML"],
  ["id", "ID"],
  ["ids", "IDs"],
  ["og", "OG"],
  ["seo", "SEO"],
  ["sku", "SKU"],
  ["url", "URL"],
  ["urls", "URLs"],
]);

/**
 * The human label of a field name: `cta_label` → "CTA Label",
 * `image_url` → "Image URL", `min_price` → "Min Price".
 *
 * The field rules carry no label of their own, so the label is derived from
 * the name the catalogue uses.
 */
function fieldLabel(name) {
  return String(name ?? "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(
      (token) => ACRONYMS.get(token.toLowerCase()) ?? token.charAt(0).toUpperCase() + token.slice(1)
    )
    .join(" ");
}

/**
 * The fields whose value is an image the admin can upload.
 *
 * `video_url` is a video, not a picture, so it keeps the plain input.
 */
function isImageField(name) {
  if (name === "og_image") return true;
  return name.endsWith("_url") && name !== "video_url";
}

/** The catalogue entry of a type, or null for a type the catalogue lacks. */
function definitionOf(type) {
  if (typeof type !== "string" || !Object.hasOwn(SECTION_TYPES, type)) return null;
  return SECTION_TYPES[type];
}

/** A string value, so a control never renders `[object Object]`. */
function textOf(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/** A number value as the text an input carries. */
function numberText(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

/** The list an array-shaped field holds, never `undefined`. */
function listOf(value) {
  return Array.isArray(value) ? value : [];
}

/** A plain object, or an empty one. */
function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export default function SectionConfigForm({ type, data, style, onChange, onStyleChange }) {
  const formId = useId();
  const definition = definitionOf(type);
  const values = objectOf(data);
  const styleValues = objectOf(style);

  if (!definition) {
    return (
      <p role="alert" className="form-error">
        {`${type || "This section"} is not a known section type.`}
      </p>
    );
  }

  const setValue = (name, value) => onChange?.({ ...values, [name]: value });
  const setStyleValue = (name, value) => onStyleChange?.({ ...styleValues, [name]: value });

  /** The catalogue's own check, so the admin sees the server's message. */
  const result = validateSection({ type, data: values, style: styleValues });
  const errors = result.ok ? [] : result.errors;

  /**
   * The control for one field.
   *
   * `current` is the block the field lives in and `update` writes it back, so
   * the same control renders the data fields and the shared style fields.
   */
  const renderControl = (name, rule, current, update) => {
    const fieldId = `${formId}-${name}`;
    const label = fieldLabel(name);
    const value = current[name];

    switch (rule.type) {
      case "string":
        return (
          <Input
            id={fieldId}
            type="text"
            maxLength={rule.max}
            value={textOf(value)}
            onChange={(event) => update(name, event.target.value)}
          />
        );

      case "text":
        return (
          <textarea
            id={fieldId}
            className="ui-input"
            rows={5}
            maxLength={rule.max}
            value={textOf(value)}
            onChange={(event) => update(name, event.target.value)}
          />
        );

      case "url": {
        const upload = isImageField(name);
        return (
          <div style={{ display: "grid", gap: 8 }}>
            {upload && (
              <ImageField
                label={label}
                value={textOf(value)}
                onChange={(url) => update(name, url ?? "")}
              />
            )}
            <Input
              id={fieldId}
              aria-label={upload ? label : undefined}
              type="text"
              inputMode="url"
              maxLength={rule.max}
              placeholder={upload ? "https://example.com/image.jpg" : undefined}
              value={textOf(value)}
              onChange={(event) => update(name, event.target.value)}
            />
          </div>
        );
      }

      case "link":
        return (
          <div style={{ display: "grid", gap: 4 }}>
            <Input
              id={fieldId}
              type="text"
              inputMode="url"
              maxLength={rule.max}
              value={textOf(value)}
              onChange={(event) => update(name, event.target.value)}
            />
            <span className="form-hint text-sm">
              Hash routes are accepted — #/category/electronics, #/products.
            </span>
          </div>
        );

      case "enum":
        return (
          <select
            id={fieldId}
            className="form-select-field"
            value={rule.values.includes(value) ? value : (rule.values[0] ?? "")}
            onChange={(event) => update(name, event.target.value)}
          >
            {rule.values.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <label className="form-label" htmlFor={fieldId} style={{ display: "flex", gap: 8 }}>
            <input
              id={fieldId}
              type="checkbox"
              checked={value === true}
              onChange={(event) => update(name, event.target.checked)}
            />
            {label}
          </label>
        );

      case "number":
        return (
          <Input
            id={fieldId}
            type="number"
            min={rule.min}
            max={rule.max}
            value={numberText(value)}
            onChange={(event) =>
              update(name, event.target.value === "" ? "" : Number(event.target.value))
            }
          />
        );

      case "uuid_list": {
        const ids = listOf(value);
        return (
          <div style={{ display: "grid", gap: 8 }}>
            {ids.map((id, index) => (
              <div key={`${fieldId}-${index}`} style={{ display: "flex", gap: 8 }}>
                <Input
                  type="text"
                  aria-label={`${label} ${index + 1}`}
                  value={textOf(id)}
                  onChange={(event) => {
                    const next = [...ids];
                    next[index] = event.target.value;
                    update(name, next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label} ${index + 1}`}
                  onClick={() =>
                    update(
                      name,
                      ids.filter((_, at) => at !== index)
                    )
                  }
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Add ${label}`}
                onClick={() => update(name, [...ids, ""])}
              >
                <Plus size={15} />
                <span>Add</span>
              </Button>
            </div>
            <span className="form-hint text-sm">
              The id is copied from the product or category picker — it is a lowercase UUID.
            </span>
          </div>
        );
      }

      case "item_list": {
        const items = listOf(value);
        const keys = Array.isArray(rule.items) ? rule.items : [];
        return (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item, index) => {
              const entry = objectOf(item);
              return (
                <fieldset
                  key={`${fieldId}-${index}`}
                  className="form-group"
                  style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                >
                  <legend className="form-label">
                    {label} {index + 1}
                  </legend>
                  {keys.map((key) => {
                    const entryId = `${fieldId}-${index}-${key}`;
                    return (
                      <div key={key} className="form-group">
                        <label className="form-label" htmlFor={entryId}>
                          {fieldLabel(key)}
                        </label>
                        <Input
                          id={entryId}
                          type="text"
                          value={textOf(entry[key])}
                          onChange={(event) => {
                            const next = [...items];
                            next[index] = { ...entry, [key]: event.target.value };
                            update(name, next);
                          }}
                        />
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${label} ${index + 1}`}
                    onClick={() =>
                      update(
                        name,
                        items.filter((_, at) => at !== index)
                      )
                    }
                  >
                    <Trash2 size={15} />
                    <span>Remove</span>
                  </Button>
                </fieldset>
              );
            })}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Add ${label}`}
                onClick={() =>
                  update(name, [...items, Object.fromEntries(keys.map((key) => [key, ""]))])
                }
              >
                <Plus size={15} />
                <span>Add</span>
              </Button>
            </div>
          </div>
        );
      }

      default:
        return (
          <p role="alert" className="form-error">
            {`${label} has an unsupported field type.`}
          </p>
        );
    }
  };

  /** One field of a block: its label and its control. */
  const renderField = (name, rule, current, update) => {
    const label = fieldLabel(name);
    const fieldId = `${formId}-${name}`;
    // A boolean carries its own label, and an uploadable image carries the
    // label in its fieldset — a second visible label would make the control
    // ambiguous.
    const carriesOwnLabel = rule.type === "boolean" || (rule.type === "url" && isImageField(name));

    return (
      <div key={name} className="form-group">
        {carriesOwnLabel ? null : (
          <label className="form-label" htmlFor={fieldId}>
            {label}
            {rule.required ? " *" : ""}
          </label>
        )}
        {renderControl(name, rule, current, update)}
      </div>
    );
  };

  return (
    <div className="section-config-form" style={{ display: "grid", gap: 16 }}>
      {Object.entries(definition.fields).map(([name, rule]) =>
        renderField(name, rule, values, setValue)
      )}

      {onStyleChange ? (
        <fieldset className="form-group" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend className="form-label">Layout</legend>
          {Object.entries(SECTION_STYLE_FIELDS).map(([name, rule]) =>
            renderField(name, rule, styleValues, setStyleValue)
          )}
        </fieldset>
      ) : null}

      {errors.length > 0 && (
        <div role="alert" className="form-error">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
