import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import OrderStatusChart from "./OrderStatusChart";

describe("OrderStatusChart", () => {
  const sampleStatuses = {
    pending: 5,
    processing: 10,
    shipped: 15,
    delivered: 60,
    cancelled: 10,
  };

  it("renders empty state when data is not provided or zero", () => {
    render(<OrderStatusChart data={null} />);
    expect(screen.getByText("No orders yet")).toBeInTheDocument();
  });

  it("calculates fulfillment rate correctly", () => {
    render(<OrderStatusChart data={sampleStatuses} />);
    // total = 5 + 10 + 15 + 60 + 10 = 100
    // delivered = 60 => 60.0%
    expect(screen.getByText(/60.0% Delivered/)).toBeInTheDocument();
    expect(screen.getByText(/\(60 of 100 orders\)/)).toBeInTheDocument();
  });
});
