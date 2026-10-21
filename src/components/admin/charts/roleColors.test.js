import { describe, expect, it } from "vitest";
import { ROLE_LABELS } from "../adminConstants";
import { ROLE_COLORS, ROLE_COLOR_FALLBACK, roleColor, roleLabel } from "./roleColors";

describe("roleColor", () => {
  it("colours every role slug the console passes", () => {
    for (const slug of ["super_admin", "admin", "vendor", "user"]) {
      expect(roleColor(slug)).toBe(ROLE_COLORS[slug]);
    }
  });

  it("never falls back to grey for a known role label", () => {
    for (const label of Object.values(ROLE_LABELS)) {
      expect(roleColor(label)).not.toBe(ROLE_COLOR_FALLBACK);
    }
    expect(roleColor("Super Admin")).toBe(ROLE_COLORS.super_admin);
    expect(roleColor("Customer")).toBe(ROLE_COLORS.user);
  });

  it("only greys out a role the palette does not know", () => {
    expect(roleColor("auditor")).toBe(ROLE_COLOR_FALLBACK);
    expect(roleColor(null)).toBe(ROLE_COLOR_FALLBACK);
  });
});

describe("roleLabel", () => {
  it("labels a slug from the shared map", () => {
    expect(roleLabel("super_admin")).toBe("Super Admin");
    expect(roleLabel("user")).toBe(ROLE_LABELS.user);
  });

  it("passes an unknown role through instead of inventing one", () => {
    expect(roleLabel("auditor")).toBe("auditor");
    expect(roleLabel(null)).toBe("—");
  });
});
