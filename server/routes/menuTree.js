/**
 * Pure helper: build a 3-level menu tree from flat DB rows.
 *
 * Single-pass map by id, children attached via parent_id, inactive rows
 * dropped, siblings sorted by order_index. Circular references are guarded
 * with an ancestor walk (visited set) and nesting is capped at depth 3
 * (levels 1-3).
 *
 * @param {Array<object>} rows - flat menu rows
 * @param {string|{role?:string}} [roleOrOptions] - role used for
 *   roles_allowed filtering; "super_admin" sees all rows
 * @returns {Array<object>} root nodes, each with a `children` array
 */
export function buildMenuTree(rows, roleOrOptions) {
  const role = typeof roleOrOptions === "string" ? roleOrOptions : roleOrOptions?.role;
  const list = Array.isArray(rows) ? rows : [];

  const visible = (row) => {
    if (row && row.is_active === false) return false;
    if (!role || role === "super_admin") return true;
    if (!row.roles_allowed || row.roles_allowed.length === 0) return true;
    return row.roles_allowed.includes(role);
  };

  // Single pass: index every visible row by id.
  const byId = new Map();
  for (const row of list) {
    if (!row || row.id == null || !visible(row)) continue;
    // Levels outside 1-3 never render in the tree.
    if (row.level != null && (row.level < 1 || row.level > 3)) continue;
    byId.set(row.id, { ...row, children: [] });
  }

  const sortByOrder = (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0);

  // Returns true when attaching `childId` under `parentId` would create a
  // cycle (child already an ancestor of parent, or self-parenting).
  const createsCycle = (childId, parentId) => {
    const visited = new Set([childId]);
    let current = parentId;
    while (current != null) {
      if (visited.has(current)) return true;
      visited.add(current);
      const node = byId.get(current);
      current = node?.parent_id ?? null;
    }
    return false;
  };

  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null;
    if (parentId == null || !byId.has(parentId) || createsCycle(node.id, parentId)) {
      roots.push(node);
    } else {
      byId.get(parentId).children.push(node);
    }
  }

  // Cap nesting at depth 3 and sort siblings by order_index, recursively.
  const prune = (nodes, depth) => {
    nodes.sort(sortByOrder);
    for (const node of nodes) {
      if (depth >= 3) {
        node.children = [];
      } else {
        prune(node.children, depth + 1);
      }
    }
    return nodes;
  };

  return prune(roots, 1);
}

export default buildMenuTree;
