import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "./SettingsContext";
import { apiFetchSettings } from "../api/settingsApi";
import {
  CURRENCY,
  CURRENCY_LOCALE,
  CURRENCY_SYMBOL,
  configureCurrency,
  formatCurrency,
} from "../lib/currency";

vi.mock("../api/settingsApi", () => ({
  apiFetchSettings: vi.fn(),
}));

function Probe() {
  const { settings, loading, error, refresh } = useSettings();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="keys">{Object.keys(settings).sort().join("|")}</span>
      <span data-testid="store">{settings.store?.name ?? ""}</span>
      <span data-testid="money">{formatCurrency(1000)}</span>
      <button type="button" onClick={() => refresh()}>
        refresh
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  configureCurrency(null);
  apiFetchSettings.mockResolvedValue({
    settings: {
      currency: { code: "INR", symbol: "₹", locale: "en-IN" },
      store: { name: "Marvel", country: "India" },
      shipping: { free_threshold: 499 },
    },
  });
});

afterEach(() => {
  configureCurrency(null);
});

describe("SettingsProvider", () => {
  it("calls the settings fetcher once on mount and exposes the map", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(apiFetchSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("keys")).toHaveTextContent("currency|shipping|store");
    expect(screen.getByTestId("store")).toHaveTextContent("Marvel");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("still resolves to an empty map when the backend returns nothing", async () => {
    apiFetchSettings.mockResolvedValue({ settings: {} });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("keys")).toHaveTextContent("");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("reports the error and an empty map when the request rejects", async () => {
    apiFetchSettings.mockRejectedValue(new Error("Could not load settings."));

    expect(() => renderProvider()).not.toThrow();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("error")).toHaveTextContent("Could not load settings.");
    expect(screen.getByTestId("keys")).toHaveTextContent("");
  });

  it("points the currency module at the backend's currency", async () => {
    apiFetchSettings.mockResolvedValue({
      settings: { currency: { code: "USD", symbol: "$", locale: "en-US" } },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("money")).toHaveTextContent("$1,000"));

    expect(CURRENCY).toBe("USD");
    expect(CURRENCY_SYMBOL).toBe("$");
    expect(CURRENCY_LOCALE).toBe("en-US");
  });

  it("keeps the INR fallback when the settings omit a currency row", async () => {
    apiFetchSettings.mockResolvedValue({ settings: { store: { name: "Marvel" } } });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("money")).toHaveTextContent("₹1,000");
    expect(CURRENCY).toBe("INR");
    expect(CURRENCY_SYMBOL).toBe("₹");
    expect(CURRENCY_LOCALE).toBe("en-IN");
  });

  it("re-runs the request when refresh() is called", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => {
      screen.getByRole("button", { name: "refresh" }).click();
    });

    await waitFor(() => expect(apiFetchSettings).toHaveBeenCalledTimes(2));
  });

  it("refreshes when the settings-update event fires", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => {
      window.dispatchEvent(new Event("marvel_settings_updated"));
    });

    await waitFor(() => expect(apiFetchSettings).toHaveBeenCalledTimes(2));
  });

  it("refreshes when the content-update event fires", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => {
      window.dispatchEvent(new Event("marvel_content_updated"));
    });

    await waitFor(() => expect(apiFetchSettings).toHaveBeenCalledTimes(2));
  });

  it("removes both update listeners on unmount", async () => {
    const { unmount } = renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    unmount();

    act(() => {
      window.dispatchEvent(new Event("marvel_settings_updated"));
      window.dispatchEvent(new Event("marvel_content_updated"));
    });

    expect(apiFetchSettings).toHaveBeenCalledTimes(1);
  });
});

describe("useSettings outside the provider", () => {
  it("returns an empty, settled map instead of crashing the surface", () => {
    expect(() => render(<Probe />)).not.toThrow();

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(screen.getByTestId("keys")).toHaveTextContent("");
  });
});
