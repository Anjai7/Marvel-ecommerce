import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui";
import { apiFetch } from "../../api/client";
import { OPTION_KIND_LABELS, OPTION_KINDS } from "../../lib/productOptions";
import { getCategorySuggestions } from "./productOptionSuggestions";
import "./product-variants-editor.css";

/**
 * The option values and the sellable variants of one product.
 *
 * The component is controlled: it never keeps its own copy of the data, it
 * calls `onChange` with the whole `{ variants, combinations }` object whenever
 * anything changes and renders what it is given.
 *
 *   <ProductVariantsEditor
 *     value={{ variants: [...], combinations: [...] }}
 *     onChange={(next) => {}}
 *     category="Electronics"
 *     categoryId={null}
 *     productPrice={4999}
 *     productStock={25}
 *   />
 *
 * `variants` are the option values — `{ kind, label, value, option_value_id }`
 * — and `combinations` are the sellable variants — `{ sku, price, stock,
 * image_url, options: [{ kind, label, value }] }`.
 */

/**
 * The labels the shared module should carry. They are only a safety net: the
 * shared `OPTION_KIND_LABELS` wins whenever it knows the kind.
 */
const FALLBACK_KIND_LABELS = {
  color: "Colour",
  size: "Size",
  capacity: "Capacity",
  storage: "Storage",
  material: "Material",
  style: "Style",
  weight: "Weight",
  flavour: "Flavour",
};

/** Every kind the editor offers, in the order the contract lists them. */
const KINDS =
  Array.isArray(OPTION_KINDS) && OPTION_KINDS.length > 0
    ? OPTION_KINDS
    : Object.keys(FALLBACK_KIND_LABELS);

/** What the customer reads for one kind. */
const kindLabel = (kind) => OPTION_KIND_LABELS?.[kind] ?? FALLBACK_KIND_LABELS[kind] ?? kind;

/** A number, or `null` for "not stated". Never `0` for an empty field. */
function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A trimmed string, or `""` for nothing. */
const text = (value) => String(value ?? "").trim();

/** True when the combination carries this option value. */
function usesOption(combo, option) {
  if (!option) return false;
  const options = Array.isArray(combo?.options) ? combo.options : [];
  return options.some((entry) => {
    if (!entry || entry.kind !== option.kind) return false;
    if (text(entry.label) && text(entry.label) === text(option.label)) return true;
    if (text(entry.value) && text(entry.value) === text(option.value)) return true;
    return false;
  });
}

/**
 * The catalogue row for a kind and label, if the store already has one.
 *
 * A match means the value is linked: renaming it in the catalogue renames it
 * on every product that uses it.
 */
function findCatalogueRow(catalogue, kind, label) {
  const wanted = text(label).toLowerCase();
  if (!wanted) return null;
  return (
    catalogue.find((row) => {
      if (!row || row.kind !== kind) return false;
      return text(row.label).toLowerCase() === wanted || text(row.value).toLowerCase() === wanted;
    }) ?? null
  );
}

export default function ProductVariantsEditor({
  value,
  onChange,
  category = "",
  productPrice = null,
  productStock = null,
}) {
  const variants = useMemo(() => (Array.isArray(value?.variants) ? value.variants : []), [value]);
  const combinations = useMemo(
    () => (Array.isArray(value?.combinations) ? value.combinations : []),
    [value]
  );

  // The shared catalogue of option values. The endpoint may not exist yet, so
  // a failure is not an error — the editor simply has no catalogue to link to.
  const [catalogue, setCatalogue] = useState([]);
  // What the admin has typed but not added yet, per kind.
  const [drafts, setDrafts] = useState({});
  // Kinds the admin has chosen but has not given a value yet.
  const [pendingKinds, setPendingKinds] = useState([]);
  // The kind picked in the "Add option" dropdown.
  const [pendingKind, setPendingKind] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => apiFetch("/product-option-values"))
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.values) ? data.values : [];
        setCatalogue(rows.filter((row) => row && row.id && row.kind));
      })
      .catch(() => {
        // No catalogue yet — carry on without one.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The option kinds in play: the ones with values, then the empty ones. */
  const kinds = useMemo(() => {
    const ordered = [];
    for (const entry of variants) {
      if (entry?.kind && !ordered.includes(entry.kind)) ordered.push(entry.kind);
    }
    for (const kind of pendingKinds) {
      if (!ordered.includes(kind)) ordered.push(kind);
    }
    return ordered;
  }, [variants, pendingKinds]);

  /** The values of every kind, in the order they were added. */
  const valuesByKind = useMemo(() => {
    const grouped = new Map();
    for (const kind of kinds) grouped.set(kind, []);
    for (const entry of variants) {
      if (!entry?.kind) continue;
      if (!grouped.has(entry.kind)) grouped.set(entry.kind, []);
      grouped.get(entry.kind).push(entry);
    }
    return grouped;
  }, [variants, kinds]);

  /** Every change leaves the component through here. */
  const emit = useCallback(
    (nextVariants, nextCombinations) => {
      if (typeof onChange !== "function") return;
      onChange({ variants: nextVariants, combinations: nextCombinations });
    },
    [onChange]
  );

  /** An option value, linked to the catalogue when the store already has it. */
  const buildEntry = useCallback(
    (kind, label, hex = "") => {
      const cleanLabel = text(label);
      const match = findCatalogueRow(catalogue, kind, cleanLabel);
      if (match) {
        return {
          kind,
          label: text(match.label) || cleanLabel,
          value: text(match.value) || text(match.label) || cleanLabel,
          option_value_id: match.id,
        };
      }
      return {
        kind,
        label: cleanLabel,
        value: kind === "color" && text(hex) ? text(hex) : cleanLabel,
        option_value_id: null,
      };
    },
    [catalogue]
  );

  const addValue = useCallback(
    (kind) => {
      const draft = drafts[kind] ?? {};
      const label = text(draft.label);
      if (!label) return;
      const entry = buildEntry(kind, label, draft.hex);
      const nextVariants = [...variants, entry];
      setDrafts((previous) => ({ ...previous, [kind]: { label: "", hex: "" } }));
      setPendingKinds((previous) => previous.filter((item) => item !== kind));
      emit(nextVariants, combinations);
    },
    [drafts, buildEntry, variants, combinations, emit]
  );

  const removeValue = useCallback(
    (kind, label) => {
      const removed = variants.find((entry) => entry?.kind === kind && entry?.label === label);
      const nextVariants = variants.filter(
        (entry) => !(entry?.kind === kind && entry?.label === label)
      );
      const nextCombinations = combinations.filter((combo) => !usesOption(combo, removed));
      const stillHasValues = nextVariants.some((entry) => entry?.kind === kind);
      setPendingKinds((previous) =>
        stillHasValues
          ? previous.filter((item) => item !== kind)
          : previous.includes(kind)
            ? previous
            : [...previous, kind]
      );
      emit(nextVariants, nextCombinations);
    },
    [variants, combinations, emit]
  );

  const removeOption = useCallback(
    (kind) => {
      const removedValues = variants.filter((entry) => entry?.kind === kind);
      const nextVariants = variants.filter((entry) => entry?.kind !== kind);
      const nextCombinations = combinations.filter(
        (combo) => !removedValues.some((removed) => usesOption(combo, removed))
      );
      setPendingKinds((previous) => previous.filter((item) => item !== kind));
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[kind];
        return next;
      });
      emit(nextVariants, nextCombinations);
    },
    [variants, combinations, emit]
  );

  const addOptionKind = useCallback((kind) => {
    if (!kind) return;
    setPendingKinds((previous) => (previous.includes(kind) ? previous : [...previous, kind]));
    setPendingKind("");
  }, []);

  /** Adds a whole suggested block — the kind and all of its values. */
  const addSuggestion = useCallback(
    (suggestion) => {
      const nextVariants = [...variants];
      for (const option of suggestion?.options ?? []) {
        const kind = option?.kind;
        if (!kind || !KINDS.includes(kind)) continue;
        const existing = nextVariants
          .filter((entry) => entry?.kind === kind)
          .map((entry) => entry?.label);
        for (const raw of option?.values ?? []) {
          const label = text(raw);
          if (!label || existing.includes(label)) continue;
          nextVariants.push(buildEntry(kind, label));
          existing.push(label);
        }
      }
      setPendingKinds((previous) =>
        previous.filter((kind) => nextVariants.some((entry) => entry?.kind === kind))
      );
      emit(nextVariants, combinations);
    },
    [variants, combinations, buildEntry, emit]
  );

  /** Every combination of the chosen values, priced and stocked like the product. */
  const generateCombinations = useCallback(() => {
    const blocks = kinds
      .map((kind) => ({ kind, values: valuesByKind.get(kind) ?? [] }))
      .filter((block) => block.values.length > 0);
    if (!blocks.length) return;

    const generated = [];
    const walk = (index, chosen) => {
      if (index === blocks.length) {
        generated.push({
          sku: "",
          price: numberOrNull(productPrice),
          stock: numberOrNull(productStock),
          image_url: "",
          options: chosen.map((entry) => ({
            kind: entry.kind,
            label: entry.label,
            value: entry.value,
          })),
        });
        return;
      }
      const block = blocks[index];
      for (const value of block.values) {
        walk(index + 1, [...chosen, { kind: block.kind, label: value.label, value: value.value }]);
      }
    };
    walk(0, []);
    emit(variants, generated);
  }, [kinds, valuesByKind, productPrice, productStock, variants, emit]);

  const addRow = useCallback(() => {
    emit(variants, [
      ...combinations,
      { sku: "", price: null, stock: null, image_url: "", options: [] },
    ]);
  }, [variants, combinations, emit]);

  const updateCombination = useCallback(
    (index, patch) => {
      const nextCombinations = combinations.map((combo, at) =>
        at === index ? { ...combo, ...patch } : combo
      );
      emit(variants, nextCombinations);
    },
    [variants, combinations, emit]
  );

  /** Editing an option cell changes that combination's entry for the kind. */
  const setCombinationOption = useCallback(
    (index, kind, value) => {
      const combo = combinations[index];
      if (!combo) return;
      const existing = (Array.isArray(combo.options) ? combo.options : []).filter(
        (entry) => entry && entry.kind !== kind
      );
      const options = [...existing, { kind, label: value, value }];
      const known = options
        .filter((entry) => kinds.includes(entry.kind))
        .sort((left, right) => kinds.indexOf(left.kind) - kinds.indexOf(right.kind));
      const unknown = options.filter((entry) => !kinds.includes(entry.kind));
      updateCombination(index, { options: [...known, ...unknown] });
    },
    [combinations, kinds, updateCombination]
  );

  const removeCombination = useCallback(
    (index) => {
      emit(
        variants,
        combinations.filter((_combo, at) => at !== index)
      );
    },
    [variants, combinations, emit]
  );

  const setDraft = useCallback((kind, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [kind]: { label: "", hex: "", ...(previous[kind] ?? {}), [field]: value },
    }));
  }, []);

  const suggestions = useMemo(() => getCategorySuggestions(category), [category]);
  const suggestionBlocks = useMemo(() => {
    if (!text(category)) return [];
    return (suggestions.options ?? []).filter(
      (option) =>
        option?.kind &&
        !kinds.includes(option.kind) &&
        Array.isArray(option.values) &&
        option.values.length > 0
    );
  }, [category, suggestions, kinds]);

  const availableKinds = useMemo(() => KINDS.filter((kind) => !kinds.includes(kind)), [kinds]);

  const hasValues = variants.length > 0;

  return (
    <section className="product-variants" aria-labelledby="product-variants-heading">
      <div className="product-variants__header">
        <h3 id="product-variants-heading" className="chart-title">
          Options &amp; Variants
        </h3>
        <p className="chart-subtitle">
          The choices a customer makes (colour, size, storage) and the sellable variants they make
          them in.
        </p>
      </div>

      <div className="product-variants__options">
        {kinds.map((kind) => {
          const optionValues = valuesByKind.get(kind) ?? [];
          const draft = drafts[kind] ?? { label: "", hex: "" };
          return (
            <fieldset
              key={kind}
              className="product-variants__option"
              data-testid={`product-variants-option-${kind}`}
            >
              <legend className="product-variants__option-title">{kindLabel(kind)}</legend>
              <div className="product-variants__option-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${kindLabel(kind)} option`}
                  onClick={() => removeOption(kind)}
                  data-testid={`product-variants-remove-option-${kind}`}
                >
                  Remove option
                </Button>
              </div>

              <ul className="product-variants__chips">
                {optionValues.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.label}`}
                    className="product-variants__chip"
                    data-testid={`product-variants-chip-${entry.kind}-${entry.label}`}
                  >
                    <span className="product-variants__chip-text">{entry.label}</span>
                    {entry.option_value_id ? (
                      <span className="product-variants__chip-linked">linked</span>
                    ) : null}
                    <button
                      type="button"
                      className="product-variants__chip-remove"
                      aria-label={`Remove ${entry.label}`}
                      onClick={() => removeValue(kind, entry.label)}
                      data-testid={`product-variants-remove-value-${entry.kind}-${entry.label}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <div className="product-variants__add-value">
                <label
                  className="product-variants__label"
                  htmlFor={`product-variants-value-${kind}`}
                >
                  Add value
                </label>
                <Input
                  id={`product-variants-value-${kind}`}
                  value={draft.label}
                  placeholder="e.g. Blue"
                  onChange={(event) => setDraft(kind, "label", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addValue(kind);
                    }
                  }}
                  data-testid={`product-variants-value-input-${kind}`}
                />
                {kind === "color" ? (
                  <>
                    <label
                      className="product-variants__label"
                      htmlFor={`product-variants-hex-${kind}`}
                    >
                      Hex
                    </label>
                    <Input
                      id={`product-variants-hex-${kind}`}
                      value={draft.hex}
                      placeholder="#1e3a8a"
                      onChange={(event) => setDraft(kind, "hex", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addValue(kind);
                        }
                      }}
                      data-testid={`product-variants-hex-input-${kind}`}
                    />
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addValue(kind)}
                  data-testid={`product-variants-add-value-${kind}`}
                >
                  Add value
                </Button>
              </div>
            </fieldset>
          );
        })}

        <div className="product-variants__add-option">
          <label className="product-variants__label" htmlFor="product-variants-add-kind">
            Add option
          </label>
          <select
            id="product-variants-add-kind"
            className="form-select-field product-variants__select"
            value={pendingKind}
            onChange={(event) => setPendingKind(event.target.value)}
            data-testid="product-variants-add-kind-select"
          >
            <option value="">Choose an option…</option>
            {availableKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pendingKind}
            onClick={() => addOptionKind(pendingKind)}
            data-testid="product-variants-add-kind-button"
          >
            Add option
          </Button>
        </div>

        {suggestionBlocks.length > 0 ? (
          <div className="product-variants__suggestions">
            <span className="product-variants__suggestions-title">
              Suggestions for {suggestions.label}
            </span>
            {suggestionBlocks.map((option) => (
              <button
                key={option.kind}
                type="button"
                className="product-variants__suggestion"
                onClick={() => addSuggestion({ options: [option] })}
                data-testid={`product-variants-suggestion-${option.kind}`}
              >
                Add suggested: {kindLabel(option.kind)} ({option.values.slice(0, 3).join(", ")}…)
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {hasValues ? (
        <div className="product-variants__matrix">
          <div className="product-variants__matrix-head">
            <h4 className="product-variants__matrix-title">Variants</h4>
            <div className="product-variants__matrix-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateCombinations}
                data-testid="product-variants-generate"
              >
                Generate combinations
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
                data-testid="product-variants-add-row"
              >
                + Add row
              </Button>
            </div>
          </div>

          {combinations.length === 0 ? (
            <p className="product-variants__empty">
              No variants yet — generate the combinations or add a row.
            </p>
          ) : (
            <div className="table-responsive-wrapper">
              <Table className="ui-table--cards">
                <TableHeader>
                  <TableRow>
                    {kinds.map((kind) => (
                      <TableHead key={kind} scope="col">
                        {kindLabel(kind)}
                      </TableHead>
                    ))}
                    <TableHead scope="col">SKU</TableHead>
                    <TableHead scope="col">Price</TableHead>
                    <TableHead scope="col">Stock</TableHead>
                    <TableHead scope="col">Image URL</TableHead>
                    <TableHead scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinations.map((combo, index) => {
                    const options = Array.isArray(combo?.options) ? combo.options : [];
                    return (
                      <TableRow key={index} data-testid={`product-variants-row-${index}`}>
                        {kinds.map((kind) => {
                          const entry = options.find((option) => option?.kind === kind);
                          return (
                            <TableCell key={kind} data-label={kindLabel(kind)}>
                              <Input
                                value={text(entry?.label)}
                                aria-label={`${kindLabel(kind)} for variant ${index + 1}`}
                                onChange={(event) =>
                                  setCombinationOption(index, kind, event.target.value)
                                }
                                data-testid={`product-variants-cell-${index}-${kind}`}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell data-label="SKU">
                          <Input
                            value={text(combo?.sku)}
                            aria-label={`SKU for variant ${index + 1}`}
                            onChange={(event) =>
                              updateCombination(index, { sku: event.target.value })
                            }
                            data-testid={`product-variants-sku-${index}`}
                          />
                        </TableCell>
                        <TableCell data-label="Price">
                          <Input
                            type="number"
                            value={combo?.price ?? ""}
                            aria-label={`Price for variant ${index + 1}`}
                            onChange={(event) =>
                              updateCombination(index, { price: numberOrNull(event.target.value) })
                            }
                            data-testid={`product-variants-price-${index}`}
                          />
                        </TableCell>
                        <TableCell data-label="Stock">
                          <Input
                            type="number"
                            value={combo?.stock ?? ""}
                            aria-label={`Stock for variant ${index + 1}`}
                            onChange={(event) =>
                              updateCombination(index, { stock: numberOrNull(event.target.value) })
                            }
                            data-testid={`product-variants-stock-${index}`}
                          />
                        </TableCell>
                        <TableCell data-label="Image URL">
                          <Input
                            value={text(combo?.image_url)}
                            aria-label={`Image URL for variant ${index + 1}`}
                            onChange={(event) =>
                              updateCombination(index, { image_url: event.target.value })
                            }
                            data-testid={`product-variants-image-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove variant ${index + 1}`}
                            onClick={() => removeCombination(index)}
                            data-testid={`product-variants-remove-row-${index}`}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <p className="product-variants__empty" data-testid="product-variants-empty">
          This product has no options.
        </p>
      )}
    </section>
  );
}
