import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CustomerReviews from "./CustomerReviews";

describe("CustomerReviews", () => {
  it("says there are no reviews instead of inventing a summary", () => {
    render(<CustomerReviews reviews={{ overall: null, total: 0, breakdown: {}, items: [] }} />);

    expect(
      screen.getByText("No reviews have been published for this product yet.")
    ).toBeInTheDocument();
    expect(screen.queryByText("4.8")).not.toBeInTheDocument();
    expect(screen.queryByText("128")).not.toBeInTheDocument();
    expect(screen.queryByText("72%")).not.toBeInTheDocument();
    expect(screen.queryByText(/Alex Rivera/)).not.toBeInTheDocument();
  });

  it("renders the API summary, breakdown and rows", () => {
    const { container } = render(
      <CustomerReviews
        reviews={{
          overall: 4.5,
          total: 2,
          breakdown: { 5: 1, 4: 1 },
          items: [
            {
              id: "r1",
              author_name: "Asha Rao",
              rating: 5,
              title: "Great fit",
              body: "Comfortable on long runs.",
              is_verified: true,
              created_at: "2026-10-01T10:00:00.000Z",
            },
            {
              id: "r2",
              author_name: "Ben Okafor",
              rating: 4,
              title: "Good value",
              body: "Runs a little narrow.",
              is_verified: false,
              created_at: "2026-09-20T10:00:00.000Z",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("2 Reviews")).toBeInTheDocument();
    const widths = [...container.querySelectorAll(".cr-bar-fill")].map((node) => node.style.width);
    expect(widths).toEqual(["50%", "50%"]);
    const counts = [...container.querySelectorAll(".cr-bar-count")].map((node) => node.textContent);
    expect(counts).toEqual(["1", "1"]);
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Ben Okafor")).toBeInTheDocument();
    expect(screen.getByText("Great fit")).toBeInTheDocument();
    expect(screen.getByText("Good value")).toBeInTheDocument();

    // Only the row the API marks verified carries the badge.
    expect(screen.getAllByText("Verified Purchase")).toHaveLength(1);
  });

  it("renders no fallback rows when the reviews prop is missing", () => {
    render(<CustomerReviews />);

    expect(
      screen.getByText("No reviews have been published for this product yet.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Verified Customer")).not.toBeInTheDocument();
    expect(screen.queryByText("Excellent purchase!")).not.toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });
});
