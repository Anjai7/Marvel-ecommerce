import { describe, it, expect } from "vitest";
import { buildMenuTree } from "./menuTree.js";

const rows = [
  {
    id: "l1",
    title: "Electronics",
    path: "/category/electronics",
    level: 1,
    parent_id: null,
    order_index: 2,
    is_active: true,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
  },
  {
    id: "l1b",
    title: "Fashion",
    path: "/category/fashion",
    level: 1,
    parent_id: null,
    order_index: 1,
    is_active: true,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
  },
  {
    id: "l2",
    title: "Mobiles",
    path: "/category/electronics/mobiles",
    level: 2,
    parent_id: "l1",
    order_index: 1,
    is_active: true,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
  },
  {
    id: "l3",
    title: "Smartphones",
    path: "/category/electronics/mobiles/smartphones",
    level: 3,
    parent_id: "l2",
    order_index: 1,
    is_active: true,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
  },
  {
    id: "hidden",
    title: "Vendor Portal",
    path: "/vendor-dashboard",
    level: 1,
    parent_id: null,
    order_index: 3,
    is_active: true,
    roles_allowed: ["vendor", "admin", "super_admin"],
  },
  {
    id: "off",
    title: "Retired",
    path: "/retired",
    level: 1,
    parent_id: null,
    order_index: 4,
    is_active: false,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
  },
];

describe("buildMenuTree", () => {
  it("nests 3 levels, sorts by order_index, and drops inactive rows", () => {
    const tree = buildMenuTree(rows, "user");
    // inactive dropped
    expect(tree.some((n) => n.id === "off")).toBe(false);
    // sorted: Fashion (order 1) before Electronics (order 2)
    expect(tree[0].id).toBe("l1b");
    const electronics = tree.find((n) => n.id === "l1");
    expect(electronics.children).toHaveLength(1);
    expect(electronics.children[0].id).toBe("l2");
    expect(electronics.children[0].children[0].id).toBe("l3");
  });

  it("filters by role: vendor-only hidden from user, visible to super_admin", () => {
    const userTree = buildMenuTree(rows, "user");
    expect(userTree.some((n) => n.id === "hidden")).toBe(false);
    const rootTree = buildMenuTree(rows, "super_admin");
    expect(rootTree.some((n) => n.id === "hidden")).toBe(true);
  });

  it("guards circular refs without hanging", () => {
    const cyclic = [
      {
        id: "a",
        title: "A",
        path: "/a",
        level: 1,
        parent_id: "b",
        order_index: 1,
        is_active: true,
      },
      {
        id: "b",
        title: "B",
        path: "/b",
        level: 2,
        parent_id: "a",
        order_index: 1,
        is_active: true,
      },
    ];
    const tree = buildMenuTree(cyclic, "super_admin");
    // terminates and yields bounded output (no infinite nesting)
    expect(JSON.stringify(tree).length).toBeLessThan(5000);
    expect(tree.length).toBeGreaterThan(0);
  });

  it("caps depth at 3 levels", () => {
    const deep = [
      {
        id: "d1",
        title: "D1",
        path: "/d1",
        level: 1,
        parent_id: null,
        order_index: 1,
        is_active: true,
      },
      {
        id: "d2",
        title: "D2",
        path: "/d2",
        level: 2,
        parent_id: "d1",
        order_index: 1,
        is_active: true,
      },
      {
        id: "d3",
        title: "D3",
        path: "/d3",
        level: 3,
        parent_id: "d2",
        order_index: 1,
        is_active: true,
      },
      {
        id: "d4",
        title: "D4",
        path: "/d4",
        level: 4,
        parent_id: "d3",
        order_index: 1,
        is_active: true,
      },
    ];
    const tree = buildMenuTree(deep, "super_admin");
    const depth = (nodes, d = 1) =>
      nodes.reduce((m, n) => Math.max(m, n.children?.length ? depth(n.children, d + 1) : d), 0);
    expect(depth(tree)).toBeLessThanOrEqual(3);
  });
});
