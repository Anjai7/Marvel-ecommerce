import { render } from "@testing-library/react";
import OrderTimeline from "./OrderTimeline";

/** A minimal order shape: the timeline reads status and the Shipped-step detail. */
function makeOrder(status, extra = {}) {
  return {
    id: "ord-001",
    status,
    created_at: "2026-10-20T09:00:00.000Z",
    carrier: "DHL Worldwide",
    tracking_number: "TRK-9849201",
    ...extra,
  };
}

function steps(container) {
  return container.querySelectorAll(".customer-timeline__step");
}

describe("OrderTimeline", () => {
  it("shows four steps with the placed date and only Placed reached for a pending order", () => {
    const { container } = render(<OrderTimeline order={makeOrder("pending")} />);
    const items = steps(container);
    expect(items.length).toBe(4);
    expect(items[0].getAttribute("aria-current")).toBe("step");
    expect(items[0].className).toContain("--done");
    expect(items[1].className).not.toContain("--done");
    // The Placed step shows the created date; the others show no invented dates.
    expect(container.querySelectorAll(".customer-timeline__step-date").length).toBe(1);
  });

  it("marks Packed current for a processing order, with no invented dates elsewhere", () => {
    const { container } = render(<OrderTimeline order={makeOrder("processing")} />);
    const items = steps(container);
    expect(items.length).toBe(4);
    expect(items[1].getAttribute("aria-current")).toBe("step");
    expect(items[0].className).toContain("--done");
    expect(items[1].className).toContain("--done");
    expect(items[2].className).not.toContain("--done");
    // The date belongs to the Placed step only — Packed is a label and a tick.
    expect(container.querySelectorAll(".customer-timeline__step-date").length).toBe(1);
  });

  it("marks Shipped current for a shipped order and shows the carrier and tracking on the Shipped step", () => {
    const { container } = render(<OrderTimeline order={makeOrder("shipped")} />);
    const items = steps(container);
    expect(items[2].getAttribute("aria-current")).toBe("step");
    expect(items[2].className).toContain("--done");
    expect(items[2].textContent).toContain("DHL Worldwide");
    expect(items[2].textContent).toContain("TRK-9849201");
  });

  it("marks Delivered current for a delivered order, with every step reached", () => {
    const { container } = render(<OrderTimeline order={makeOrder("delivered")} />);
    const items = steps(container);
    expect(items[3].getAttribute("aria-current")).toBe("step");
    expect([...items].every((item) => item.className.includes("--done"))).toBe(true);
  });

  it("shows a cancelled state instead of the steps for a cancelled order", () => {
    const { container } = render(<OrderTimeline order={makeOrder("cancelled")} />);
    const items = steps(container);
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Cancelled");
    expect(items[0].getAttribute("aria-current")).toBe("step");
  });
});
