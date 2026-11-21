import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuditLog from "./AuditLog";
import { apiFetchAdminAudit } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchAdminAudit: vi.fn(),
}));

describe("AuditLog", () => {
  it("renders the latest admin writes with the operator and the date", async () => {
    apiFetchAdminAudit.mockResolvedValue({
      entries: [
        {
          id: "log-1",
          action: "stock_adjustment",
          entity: "product",
          entity_id: "prod-1",
          actor_email: "admin@test.local",
          created_at: "2026-11-21T10:30:00.000Z",
        },
      ],
    });

    render(<AuditLog />);

    expect(screen.getByText(/Loading audit entries/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Stock Adjustment")).toBeInTheDocument());
    expect(screen.getByText("product")).toBeInTheDocument();
    expect(screen.getByText(/by admin@test.local/)).toBeInTheDocument();
  });

  it("shows an error instead of an empty list when the read fails", async () => {
    apiFetchAdminAudit.mockRejectedValue(new Error("Could not load the audit log."));

    render(<AuditLog />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Could not load the audit log.")).toBeInTheDocument();
  });
});
