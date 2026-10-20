import { useEffect, useState } from "react";
import { apiFetchCategoryTree } from "../../api/contentApi";

const INDENT = "\u00A0\u00A0";

/** Level-2 and level-3 nodes, depth-first, carrying their depth for indenting. */
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
 * The level-1 rows are the `<optgroup>` labels; their level-2 and level-3
 * descendants are the selectable options, indented by depth. `onChange`
 * always receives both the id and the display name so the caller can keep the
 * free-text `products.category` label in sync (ProductCard still reads it).
 */
export default function CategoryPicker({
  value = null,
  onChange,
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
        const nextGroups = tree.map((root) => {
          const options = flattenOptions(root.children || []);
          return { root, options };
        });
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

  return (
    <div className="category-picker">
      <select
        id={id}
        className={className}
        style={style}
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled || loading || Boolean(error)}
        aria-label="Category"
      >
        <option value="">{emptyLabel}</option>
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
      {error ? (
        <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
