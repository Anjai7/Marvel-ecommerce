import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentProvider, useContent } from "./ContentContext";
import {
  apiFetchHeroSlides,
  apiFetchBanners,
  apiFetchCategories,
  apiFetchCategoryTree,
  apiFetchFooter,
  apiFetchMenuItems,
} from "../api/contentApi";

const authState = vi.hoisted(() => ({ role: "user" }));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ role: authState.role }),
}));

vi.mock("../api/contentApi", () => ({
  apiFetchHeroSlides: vi.fn(),
  apiFetchBanners: vi.fn(),
  apiFetchCategories: vi.fn(),
  apiFetchCategoryTree: vi.fn(),
  apiFetchFooter: vi.fn(),
  apiFetchMenuItems: vi.fn(),
}));

const FETCHERS = [
  apiFetchHeroSlides,
  apiFetchBanners,
  apiFetchCategories,
  apiFetchCategoryTree,
  apiFetchFooter,
  apiFetchMenuItems,
];

const NON_MENU_FETCHERS = FETCHERS.filter((fetcher) => fetcher !== apiFetchMenuItems);

function Probe() {
  const { hero, banners, categories, categoryTree, footer, menu, loading, error, refresh } =
    useContent();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="hero">{hero.map((slide) => slide.title).join("|")}</span>
      <span data-testid="banners">{banners.map((banner) => banner.title).join("|")}</span>
      <span data-testid="categories">{categories.map((category) => category.name).join("|")}</span>
      <span data-testid="category-tree">{categoryTree.map((node) => node.name).join("|")}</span>
      <span data-testid="footer">
        {footer.sections.map((section) => section.heading).join("|")}
      </span>
      <span data-testid="menu">{menu.map((item) => item.title).join("|")}</span>
      <button type="button" onClick={() => refresh()}>
        refresh
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ContentProvider>
      <Probe />
    </ContentProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = "user";
  apiFetchHeroSlides.mockResolvedValue({ slides: [{ id: "h1", title: "Hero One" }] });
  apiFetchBanners.mockResolvedValue({ banners: [{ id: "b1", title: "Banner One" }] });
  apiFetchCategories.mockResolvedValue({
    categories: [
      { id: "c1", name: "Electronics" },
      { id: "c2", name: "Mobiles" },
    ],
  });
  apiFetchCategoryTree.mockResolvedValue({
    categories: [{ id: "c1", name: "Electronics", children: [] }],
  });
  apiFetchFooter.mockResolvedValue({
    sections: [{ id: "s1", heading: "Company", links: [] }],
    links: [{ id: "l1", label: "About" }],
  });
  apiFetchMenuItems.mockResolvedValue([{ id: "m1", title: "Home" }]);
});

describe("ContentProvider", () => {
  it("calls every content fetcher once on mount", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    for (const fetcher of FETCHERS) {
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("fetches the menu with the signed-in user's role", async () => {
    authState.role = "admin";

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(apiFetchMenuItems).toHaveBeenCalledTimes(1);
    expect(apiFetchMenuItems).toHaveBeenCalledWith("admin");
  });

  it("re-fetches only the menu when the role changes", async () => {
    const { rerender } = renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(apiFetchMenuItems).toHaveBeenCalledWith("user");

    apiFetchMenuItems.mockResolvedValueOnce([{ id: "m2", title: "Vendor Home" }]);
    authState.role = "vendor";

    rerender(
      <ContentProvider>
        <Probe />
      </ContentProvider>
    );

    await waitFor(() => expect(screen.getByTestId("menu")).toHaveTextContent("Vendor Home"));

    expect(apiFetchMenuItems).toHaveBeenCalledTimes(2);
    expect(apiFetchMenuItems).toHaveBeenLastCalledWith("vendor");

    for (const fetcher of NON_MENU_FETCHERS) {
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("does not re-fetch the menu when the role is unchanged", async () => {
    const { rerender } = renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    rerender(
      <ContentProvider>
        <Probe />
      </ContentProvider>
    );

    expect(apiFetchMenuItems).toHaveBeenCalledTimes(1);
  });

  it("exposes the fetched collections", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hero")).toHaveTextContent("Hero One"));

    expect(screen.getByTestId("banners")).toHaveTextContent("Banner One");
    expect(screen.getByTestId("categories")).toHaveTextContent("Electronics|Mobiles");
    expect(screen.getByTestId("category-tree")).toHaveTextContent("Electronics");
    expect(screen.getByTestId("footer")).toHaveTextContent("Company");
    expect(screen.getByTestId("menu")).toHaveTextContent("Home");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("keeps the other collections when one fetch rejects", async () => {
    apiFetchHeroSlides.mockRejectedValue(new Error("Could not load content."));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("error")).toHaveTextContent("Could not load content.");
    expect(screen.getByTestId("hero")).toHaveTextContent("");
    expect(screen.getByTestId("banners")).toHaveTextContent("Banner One");
    expect(screen.getByTestId("categories")).toHaveTextContent("Electronics|Mobiles");
    expect(screen.getByTestId("category-tree")).toHaveTextContent("Electronics");
    expect(screen.getByTestId("footer")).toHaveTextContent("Company");
    expect(screen.getByTestId("menu")).toHaveTextContent("Home");
  });

  it("does not throw when every fetch rejects", async () => {
    for (const fetcher of FETCHERS) fetcher.mockRejectedValue(new Error("offline"));

    expect(() => renderProvider()).not.toThrow();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("error")).toHaveTextContent("offline");
  });

  it("re-runs every fetch when refresh() is called", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => {
      screen.getByRole("button", { name: "refresh" }).click();
    });

    await waitFor(() => {
      for (const fetcher of FETCHERS) {
        expect(fetcher).toHaveBeenCalledTimes(2);
      }
    });
  });

  it("refreshes when the marvel_content_updated window event fires", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => {
      window.dispatchEvent(new Event("marvel_content_updated"));
    });

    await waitFor(() => {
      for (const fetcher of FETCHERS) {
        expect(fetcher).toHaveBeenCalledTimes(2);
      }
    });
  });

  it("removes the update listener on unmount", async () => {
    const { unmount } = renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    unmount();

    act(() => {
      window.dispatchEvent(new Event("marvel_content_updated"));
    });

    for (const fetcher of FETCHERS) {
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("throws a clear error when useContent is used outside the provider", () => {
    function Orphan() {
      useContent();
      return null;
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow("useContent must be used within a ContentProvider");
    spy.mockRestore();
  });
});
