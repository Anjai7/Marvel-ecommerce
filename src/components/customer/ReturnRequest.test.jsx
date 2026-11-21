import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ReturnRequest from "./ReturnRequest";
import { apiRequestReturn } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({ apiRequestReturn: vi.fn() }));

const deliveredOrder = {
  id: "ord-9",
  status: "delivered",
  created_at: "2026-10-20T09:00:00.000Z",
  total_amount: 1999,
  items: [],
};

describe("ReturnRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Request a return button on a delivered order", () => {
    render(<ReturnRequest order={deliveredOrder} />);
    expect(screen.getByRole("button", { name: "Request a return" })).toBeInTheDocument();
  });

  it("renders nothing for an order that is not delivered", () => {
    const { container } = render(
      <ReturnRequest order={{ ...deliveredOrder, status: "processing" }} />
    );
    expect(container.querySelector(".customer-return")).toBeNull();
    expect(container.querySelector(".customer-return__form")).toBeNull();
  });

  it("opens the inline form and posts the reason and notes on submit", async () => {
    apiRequestReturn.mockResolvedValue({
      id: "ret-1",
      order_id: "ord-9",
      user_id: "usr-001",
      reason: "wrong_item",
      notes: "Cracked screen",
      created_at: "2026-11-20T10:00:00.000Z",
    });

    const { container } = render(<ReturnRequest order={deliveredOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));

    const select = screen.getByLabelText("Return reason");
    expect(select).toBeInTheDocument();
    for (const label of ["Damaged", "Wrong item", "Changed mind", "Other"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
    fireEvent.change(select, { target: { value: "wrong_item" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), {
      target: { value: "Cracked screen" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(apiRequestReturn).toHaveBeenCalledWith("ord-9", {
        reason: "wrong_item",
        notes: "Cracked screen",
      })
    );
    // The form is replaced by the recorded request, with the reason and time.
    expect(await screen.findByText("Return requested")).toBeInTheDocument();
    expect(screen.getByText(/Reason: Wrong item/)).toBeInTheDocument();
    expect(container.querySelector(".customer-return__form")).toBeNull();
  });

  it("shows the recorded reason for the default choice when the customer changes nothing", async () => {
    apiRequestReturn.mockResolvedValue({
      id: "ret-2",
      reason: "damaged",
      notes: "",
      created_at: "2026-11-20T10:05:00.000Z",
    });

    render(<ReturnRequest order={deliveredOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(apiRequestReturn).toHaveBeenCalled());
    expect(apiRequestReturn).toHaveBeenCalledWith("ord-9", { reason: "damaged", notes: "" });
    expect(await screen.findByText(/Reason: Damaged/)).toBeInTheDocument();
  });

  it("shows an error when the request cannot be saved", async () => {
    apiRequestReturn.mockRejectedValue(new Error("Server error"));

    render(<ReturnRequest order={deliveredOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText("The return request could not be saved. Please try again.")
    ).toBeInTheDocument();
  });
});
