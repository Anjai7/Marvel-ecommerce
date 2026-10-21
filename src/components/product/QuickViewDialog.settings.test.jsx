import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickViewDialog } from "./QuickViewDialog";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";

const settingsValue = vi.hoisted(() => ({
  settings: {},
  loading: false,
  error: null,
  refresh: () => {},
}));

vi.mock("../../context/SettingsContext", () => ({
  useSettings: () => settingsValue,
}));

function renderDialog(product) {
  return render(
    <ToastProvider>
      <CartProvider>
        <QuickViewDialog product={product} isOpen onClose={vi.fn()} onViewFull={vi.fn()} />
      </CartProvider>
    </ToastProvider>
  );
}

describe("QuickViewDialog trust promises", () => {
  it("prefers the platform trust promises from settings", () => {
    settingsValue.settings = {
      trust: {
        promises: [
          { title: "Free shipping over ₹999", subtitle: "On every prepaid order" },
          { title: "7 day returns", subtitle: "No questions asked" },
        ],
      },
    };

    renderDialog({
      id: "p1",
      title: "Trail Shoe",
      price: "1499.00",
      warranty: "1 year warranty",
    });

    expect(screen.getByText("Free shipping over ₹999")).toBeInTheDocument();
    expect(screen.getByText("On every prepaid order")).toBeInTheDocument();
    expect(screen.getByText("7 day returns")).toBeInTheDocument();
    expect(screen.queryByText("1 year warranty")).not.toBeInTheDocument();

    settingsValue.settings = {};
  });

  it("falls back to the product's own warranty when settings are empty", () => {
    settingsValue.settings = {};

    renderDialog({
      id: "p2",
      title: "Road Shoe",
      price: "1999.00",
      warranty: "6 months manufacturer warranty",
    });

    expect(screen.getByText("6 months manufacturer warranty")).toBeInTheDocument();
  });
});
