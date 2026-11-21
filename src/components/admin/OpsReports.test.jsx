import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OpsReports from "./OpsReports";

describe("OpsReports", () => {
  it("renders the store analytics heading and the platform revenue total", () => {
    render(
      <OpsReports
        orders={[{ id: "o1", status: "delivered", total_amount: 1000, items: [] }]}
        products={[{ id: "p1", stock: 3, price: 100 }]}
        users={[
          {
            id: "u1",
            email: "customer@test.local",
            full_name: "Rhea",
            created_at: "2026-11-01T00:00:00Z",
            role: "user",
          },
        ]}
      />
    );

    expect(screen.getByText("Store Analytics")).toBeInTheDocument();
    expect(screen.getByText("Platform Totals")).toBeInTheDocument();
    expect(screen.getByText(/grouped by fulfilment stage/i)).toBeInTheDocument();
  });

  it("shows the empty state when the console has no data yet", () => {
    render(<OpsReports orders={[]} products={[]} users={[]} />);

    expect(screen.getByText("Store Analytics")).toBeInTheDocument();
    expect(screen.getByText("No data yet.")).toBeInTheDocument();
  });
});
