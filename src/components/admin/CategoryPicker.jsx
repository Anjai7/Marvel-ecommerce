import { useEffect, useState } from "react";
import { apiFetchCategoryTree } from "../../api/contentApi";

const INDENT = "\u00A0\u00A0";

/** Every node below `nodes`, depth-first, carrying its depth for indenting. */
function flattenOptions(nodes, depth = 2) {
  const options = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    options.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) {
      options.push(...flattenOptions(node.children, depth + 1));
    }
  }
  return options;
}

/**
 * Taxonomy picker shared by the admin and vendor product forms.
 *
 * Each level-1 row is an `<optgroup>` **and** a selectable option inside its own
 * group, so a top-level category can be assigned; level-2 and level-3
 * descendants follow, indented by depth. `onChange` always receives both the id
 * and the display name so the caller can keep the free-text `products.category`
 * label in sync (ProductCard still reads it).
 *
 * A `value` that is not in the loaded tree is still rendered as a synthetic
 * option: the controlled select must never misreport a stored binding as
 * "— Uncategorised —", because re-picking the placeholder would silently clear
 * it.
 *
 * If the tree cannot be loaded the picker degrades to a free-text label input
 * that keeps the existing id. The old hardcoded dropdown always allowed a
 * category label; losing the field entirely was worse than a label-only edit.
 */
export default function CategoryPicker({
  value = null,
  onChange,
  label = null,
  emptyLabel = "— Uncategorised —",
  disabled = false,
  className = "form-select-field",
  style,
  id,
}) {
  const [groups, setGroups] = useState([]);
  const [byId, setById] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    apiFetchCategoryTree()
      .then((result) => {
        if (cancelled) return;
        const tree = Array.isArray(result) ? result : result?.categories || [];
        const nextGroups = tree.map((root) => ({
          root,
          options: [
            { id: root.id, name: root.name, depth: 1 },
            ...flattenOptions(root.children || []),
          ],
        }));
        const nextById = new Map();
        nextGroups.forEach((group) => {
          group.options.forEach((option) => nextById.set(option.id, option));
        });
        setGroups(nextGroups);
        setById(nextById);
        setLoading(false);
      })
      .catch((thrown) => {
        if (cancelled) return;
        setError(thrown?.message || "Failed to load categories.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (event) => {
    const selected = event.target.value;
    if (selected === "") {
      onChange?.(null, null);
      return;
    }
    const node = byId.get(selected);
    onChange?.(selected, node?.name ?? null);
  };

  if (error) {
    return (
      <div className="category-picker">
        <input
          id={id}
          type="text"
          className={className}
          style={style}
          defaultValue={label ?? ""}
          placeholder="Category label"
          disabled={disabled}
          aria-label="Category"
          onChange={(event) => {
            const text = event.target.value.trim();
            onChange?.(value ?? null, text === "" ? null : event.target.value);
          }}
        />
        <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>
          {error}
        </p>
      </div>
    );
  }

  const hasValueOption = value == null || byId.has(value);

  return (
    <div className="category-picker">
      <select
        id={id}
        className={className}
        style={style}
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled || loading}
        aria-label="Category"
      >
        <option value="">{emptyLabel}</option>
        {hasValueOption ? null : (
          <option value={value}>{label ? `${label} (${value})` : String(value)}</option>
        )}
        {groups.map(({ root, options }) => (
          <optgroup key={root.id} label={root.name}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {`${INDENT.repeat(Math.max(0, option.depth - 2))}${option.name}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
