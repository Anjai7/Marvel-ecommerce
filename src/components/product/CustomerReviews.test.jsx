import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerReviews from "./CustomerReviews";
import { ToastProvider } from "../ui";
import { apiCreateReview } from "../../api/productDetailsApi";
import { useSettings } from "../../context/SettingsContext";

vi.mock("../../api/productDetailsApi", () => ({ apiCreateReview: vi.fn() }));
vi.mock("../../context/SettingsContext", () => ({ useSettings: vi.fn() }));

const EMPTY_REVIEWS = { overall: null, total: 0, breakdown: {}, items: [] };

const STORED_REVIEW = {
  id: "r9",
  author_name: "Asha Rao",
  author_avatar: null,
  rating: 5,
  title: "Great fit",
  body: "Just bought it.",
  is_verified: false,
  created_at: "2026-11-21T10:00:00.000Z",
};

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

async function openForm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /write a review/i }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  // A store that never configured `reviews` keeps the write button.
  useSettings.mockReturnValue({ settings: {} });
});

describe("CustomerReviews", () => {
  it("says there are no reviews instead of inventing a summary", () => {
    render(<CustomerReviews reviews={EMPTY_REVIEWS} />);

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

  it("hides the write button when the reviews setting disables writing", () => {
    useSettings.mockReturnValue({ settings: { reviews: { allow_write: false } } });

    render(<CustomerReviews reviews={EMPTY_REVIEWS} productId="p1" />);

    expect(screen.queryByRole("button", { name: /write a review/i })).not.toBeInTheDocument();
  });

  it("shows the write button when the setting is missing and opens a labelled inline form", async () => {
    renderWithToast(<CustomerReviews reviews={EMPTY_REVIEWS} productId="p1" />);

    const user = await openForm();

    expect(screen.getByRole("heading", { name: "Write a review" })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /your rating/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /4 stars/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/review title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your review/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("heading", { name: "Write a review" })).not.toBeInTheDocument();
  });

  it("validates the rating and the review body before calling the API", async () => {
    renderWithToast(<CustomerReviews reviews={EMPTY_REVIEWS} productId="p1" />);

    const user = await openForm();
    await user.type(screen.getByLabelText(/your name/i), "Asha Rao");
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(apiCreateReview).not.toHaveBeenCalled();
    expect(screen.getByText("Please choose a star rating.")).toBeInTheDocument();
    expect(screen.getByText("Please write a few words about the product.")).toBeInTheDocument();

    // Each message is tied to its control for assistive technology.
    const body = screen.getByLabelText(/your review/i);
    expect(body).toHaveAttribute("aria-invalid", "true");
    expect(body.getAttribute("aria-describedby")).toContain("body-error");
    expect(screen.getByText("Please write a few words about the product.")).toHaveAttribute(
      "id",
      body.getAttribute("aria-describedby")
    );
  });

  it("submits the trimmed payload, closes the form and shows the returned review", async () => {
    apiCreateReview.mockResolvedValue(STORED_REVIEW);
    const onReviewAdded = vi.fn();
    renderWithToast(
      <CustomerReviews reviews={EMPTY_REVIEWS} productId="p1" onReviewAdded={onReviewAdded} />
    );

    const user = await openForm();
    await user.type(screen.getByLabelText(/your name/i), "  Asha Rao  ");
    await user.click(screen.getByRole("radio", { name: /5 stars/i }));
    await user.type(screen.getByLabelText(/review title/i), "  Great fit  ");
    await user.type(screen.getByLabelText(/your review/i), "  Just bought it.  ");
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() =>
      expect(apiCreateReview).toHaveBeenCalledWith("p1", {
        author_name: "Asha Rao",
        rating: 5,
        title: "Great fit",
        body: "Just bought it.",
      })
    );

    expect(onReviewAdded).toHaveBeenCalledWith(STORED_REVIEW);
    expect(screen.queryByRole("heading", { name: "Write a review" })).not.toBeInTheDocument();
    expect(screen.getByText("Review submitted")).toBeInTheDocument();
    expect(screen.getByText("Just bought it.")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    // The public endpoint stores it unverified, so no badge is claimed.
    expect(screen.queryByText("Verified Purchase")).not.toBeInTheDocument();
  });

  it("shows a server validation message inside the form", async () => {
    apiCreateReview.mockRejectedValue(
      Object.assign(new Error("Review text is required."), { status: 400 })
    );
    renderWithToast(<CustomerReviews reviews={EMPTY_REVIEWS} productId="p1" />);

    const user = await openForm();
    await user.type(screen.getByLabelText(/your name/i), "Asha Rao");
    await user.click(screen.getByRole("radio", { name: /4 stars/i }));
    await user.type(screen.getByLabelText(/your review/i), "Nice colour.");
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Review text is required.");
    // The form stays open for a correction.
    expect(screen.getByRole("heading", { name: "Write a review" })).toBeInTheDocument();
  });
});
