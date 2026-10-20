import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HeroBanner from "./HeroBanner";
import CategorySlider from "./CategorySlider";
import BannerLayout from "./BannerLayout";
import PromoBannerCarousel from "./PromoBannerCarousel";
import Footer from "./Footer";
import HoverNav from "./HoverNav";
import BrowseCategoriesMenu from "./BrowseCategoriesMenu";
import MobileMenu from "./MobileMenu";
import DynamicMenu from "./navigation/DynamicMenu";
import { apiFetchMenuItems } from "../api/contentApi";
import { apiFetchHeroSlides } from "../api/backendApi";

const content = vi.hoisted(() => ({ value: null }));

vi.mock("../context/ContentContext", () => ({
  useContent: () => content.value,
}));

vi.mock("../api/contentApi", () => ({
  apiFetchMenuItems: vi.fn(),
}));

vi.mock("../api/backendApi", () => ({
  apiFetchHeroSlides: vi.fn(),
}));

const ENDS_AT = new Date(Date.now() + ((2 * 60 + 5) * 60 + 30) * 1000).toISOString();

const HERO = [
  {
    id: "h1",
    badge: "Mega Sale",
    title: "Live Hero Title",
    subtitle: "The subtitle from the database",
    btn_text: "Shop the sale",
    btn_path: "/category/electronics",
    bg_image_url: "https://example.com/hero.jpg",
    bg_gradient: "",
    price_text: "From ₹499",
    order_index: 0,
    is_active: true,
  },
];

const BANNERS = [
  {
    id: "b-large",
    placement: "home_banner_layout",
    variant: "large",
    badge: "Featured",
    title: "Large Banner",
    subtitle: "Large banner subtitle",
    cta_text: "Shop large",
    cta_path: "#/category/electronics",
    image_url: "https://example.com/large.jpg",
    display_order: 0,
  },
  {
    id: "b-small-1",
    placement: "home_banner_layout",
    variant: "small",
    title: "Small One",
    subtitle: "First small banner",
    cta_text: "Shop one",
    image_url: "https://example.com/small1.jpg",
    display_order: 1,
  },
  {
    id: "b-small-2",
    placement: "home_banner_layout",
    variant: "small",
    title: "Small Two",
    subtitle: "Second small banner",
    cta_text: "Shop two",
    image_url: "https://example.com/small2.jpg",
    display_order: 2,
  },
  {
    id: "b-promo",
    placement: "home_promo_carousel",
    badge: "Mega Deal",
    title: "Promo Title",
    highlight: "Up to 70% off",
    description: "Promo description",
    cta_text: "Grab the deal",
    gallery: ["https://example.com/g1.jpg", "https://example.com/g2.jpg"],
    display_order: 0,
    ends_at: ENDS_AT,
  },
  {
    id: "b-promo-open",
    placement: "home_promo_carousel",
    badge: "Evergreen",
    title: "Evergreen Promo",
    highlight: "Always on",
    description: "No deadline",
    cta_text: "Browse",
    gallery: ["https://example.com/g3.jpg"],
    display_order: 1,
    ends_at: null,
  },
];

const CATEGORIES = [
  {
    id: "c1",
    name: "Electronics",
    slug: "electronics",
    parent_id: null,
    display_order: 0,
    image_url: "https://example.com/electronics.jpg",
    show_in_homepage: true,
  },
  {
    id: "c2",
    name: "Hidden Category",
    slug: "hidden",
    parent_id: null,
    display_order: 1,
    image_url: "https://example.com/hidden.jpg",
    show_in_homepage: false,
  },
  {
    id: "c3",
    name: "Mobiles",
    slug: "mobiles",
    parent_id: "c1",
    display_order: 0,
    show_in_homepage: true,
  },
  {
    id: "c5",
    name: "Smartphones",
    slug: "smartphones",
    parent_id: "c3",
    display_order: 0,
    show_in_homepage: true,
  },
];

const CATEGORY_TREE = [
  {
    id: "c1",
    name: "Electronics",
    slug: "electronics",
    icon: "📱",
    children: [
      {
        id: "c3",
        name: "Mobiles",
        slug: "mobiles",
        children: [{ id: "c5", name: "Smartphones", slug: "smartphones", children: [] }],
      },
    ],
  },
  { id: "c4", name: "Fashion", slug: "fashion", children: [] },
];

const FOOTER = {
  sections: [
    {
      id: "s1",
      heading: "Shop With Us",
      section_type: "links",
      links: [
        { id: "l1", label: "Track My Order", href: "#/account" },
        { id: "l2", label: "Delivery Info", href: "#/help" },
      ],
    },
    {
      id: "s2",
      heading: "Trending Now",
      section_type: "tags",
      links: [{ id: "l3", label: "Gaming Laptops", href: "#/products?q=gaming" }],
    },
  ],
  links: [],
};

const MENU = [
  {
    id: "m1",
    title: "Deals",
    path: "/category/deals",
    order_index: 0,
    is_active: true,
    children: [
      {
        id: "m2",
        title: "Today Only",
        path: "/category/deals/today",
        order_index: 0,
        is_active: true,
        children: [],
      },
    ],
  },
];

const NO_ERRORS = {
  hero: null,
  banners: null,
  categories: null,
  categoryTree: null,
  footer: null,
  menu: null,
};

const contentValue = (overrides = {}) => ({
  hero: HERO,
  banners: BANNERS,
  categories: CATEGORIES,
  categoryTree: CATEGORY_TREE,
  footer: FOOTER,
  menu: MENU,
  loading: false,
  error: null,
  errors: { ...NO_ERRORS },
  refresh: vi.fn(),
  ...overrides,
});

describe("storefront surfaces read the content context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    content.value = contentValue();
  });

  it("renders the hero from the context and sends the slide's btn_path to the CTA", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<HeroBanner onNavigate={onNavigate} />);

    expect(screen.getByRole("heading", { name: "Live Hero Title" })).toBeVisible();
    expect(screen.getByText("The subtitle from the database")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Shop the sale/ }));

    // A stored link is a hash route; a bare path is normalised into one (§4.1).
    expect(onNavigate).toHaveBeenCalledWith("#/category/electronics");
  });

  it("renders only homepage categories and navigates to the full category path", async () => {
    const user = userEvent.setup();
    render(<CategorySlider />);

    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Mobiles")).toBeVisible();
    expect(screen.getByText("Smartphones")).toBeVisible();
    expect(screen.queryByText("Hidden Category")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Electronics/ }));
    expect(window.location.hash).toBe("#/category/electronics");
  });

  it("joins level-2 and level-3 ancestors from the tree so the click cannot collapse to a slug", async () => {
    const user = userEvent.setup();
    render(<CategorySlider />);

    await user.click(screen.getByRole("button", { name: /Mobiles/ }));
    expect(window.location.hash).toBe("#/category/electronics/mobiles");

    await user.click(screen.getByRole("button", { name: /Smartphones/ }));
    expect(window.location.hash).toBe("#/category/electronics/mobiles/smartphones");
  });

  it("renders one large and two small home_banner_layout banners", () => {
    render(<BannerLayout />);

    expect(screen.getByText("Large Banner")).toBeVisible();
    expect(screen.getByText("Small One")).toBeVisible();
    expect(screen.getByText("Small Two")).toBeVisible();
    expect(screen.queryByText("Promo Title")).toBeNull();
  });

  it("renders only the banners that exist when there are fewer than three", () => {
    content.value = contentValue({ banners: [BANNERS[0]] });
    render(<BannerLayout />);

    expect(screen.getByText("Large Banner")).toBeVisible();
    expect(screen.queryByText("Small One")).toBeNull();
  });

  it("renders a banner with the database-default standard variant in a small slot", () => {
    const standard = {
      id: "b-standard",
      placement: "home_banner_layout",
      variant: "standard",
      title: "Standard Banner",
      display_order: 1,
    };
    content.value = contentValue({ banners: [BANNERS[0], standard] });
    const { container } = render(<BannerLayout />);

    expect(screen.getByText("Standard Banner")).toBeVisible();
    expect(container.querySelector("#banner-home")).toHaveTextContent("Large Banner");
    expect(container.querySelector("#banner-sm-0")).toHaveTextContent("Standard Banner");
  });

  it("renders promo banners with their gallery and a countdown computed from ends_at", () => {
    const { container } = render(<PromoBannerCarousel />);

    expect(screen.getByText("Promo Title")).toBeVisible();
    expect(container.querySelectorAll(".promo-img-item img")).toHaveLength(3);
    expect(screen.getByText("⚡ ENDS IN 02H 05M")).toBeVisible();
  });

  it("renders no fake countdown when a promo banner has no ends_at", () => {
    content.value = contentValue({ banners: [BANNERS[4]] });
    render(<PromoBannerCarousel />);

    expect(screen.getByText("Evergreen Promo")).toBeVisible();
    expect(screen.queryByText(/ENDS IN/)).toBeNull();
  });

  it("renders footer sections, their links and the tags section from the context", () => {
    render(<Footer />);

    expect(screen.getByText("Shop With Us")).toBeVisible();
    expect(screen.getByText("Track My Order")).toBeVisible();
    expect(screen.getByText("Delivery Info")).toBeVisible();
    expect(screen.getByText(/Trending Now/)).toBeVisible();
    expect(screen.getByText("Gaming Laptops")).toBeVisible();

    expect(screen.queryByText("Customer Support")).toBeNull();
    expect(screen.queryByText("Popular Searches:")).toBeNull();
  });

  it("normalises a stored footer link into a hash route", () => {
    // A bare path is not a route in this hash-routed app: it would cause a full
    // page load and a 404, so the Footer renders it as `#/…`.
    content.value = contentValue({
      footer: {
        sections: [
          {
            id: "s1",
            heading: "Shop With Us",
            links: [{ id: "l1", label: "Track My Order", href: "/help" }],
          },
        ],
        links: [],
      },
    });

    render(<Footer />);

    const link = screen.getByText("Track My Order").closest("a");
    expect(link).toHaveAttribute("href", "#/help");
  });

  it("keeps the value props, social block, payment chips and copyright in code", () => {
    render(<Footer />);

    expect(screen.getByText("Free & Fast Delivery")).toBeVisible();
    expect(screen.getByText("Follow Us:")).toBeVisible();
    expect(screen.getByText("UPI")).toBeVisible();
    expect(screen.getByText("© 2026 Marvel Inc. All Rights Reserved.")).toBeVisible();
  });

  it("renders HoverNav menu roots from the context without fetching the menu", () => {
    render(<HoverNav />);

    expect(screen.getByText("Deals")).toBeVisible();
    expect(apiFetchMenuItems).not.toHaveBeenCalled();
  });

  it("renders DynamicMenu menu roots from the context without fetching the menu", () => {
    render(<DynamicMenu />);

    expect(screen.getByText("Deals")).toBeVisible();
    expect(apiFetchMenuItems).not.toHaveBeenCalled();
  });

  it("renders BrowseCategoriesMenu categories and their children from the tree", () => {
    render(<BrowseCategoriesMenu />);

    expect(screen.getAllByText("Electronics").length).toBeGreaterThan(0);
    expect(screen.getByText("Fashion")).toBeVisible();
    expect(screen.getByText("Mobiles")).toBeVisible();
  });

  it("renders MobileMenu categories from the tree", () => {
    render(<MobileMenu isOpen onClose={vi.fn()} isLoggedIn={false} onLogin={vi.fn()} />);

    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Fashion")).toBeVisible();
  });

  it("never fetches the old content endpoints from the migrated surfaces", () => {
    render(
      <>
        <HeroBanner />
        <CategorySlider />
        <Footer />
      </>
    );

    expect(apiFetchHeroSlides).not.toHaveBeenCalled();
  });
});

describe("storefront surfaces show an explicit state when the context fails", () => {
  const errorValue = () =>
    contentValue({
      hero: [],
      banners: [],
      categories: [],
      categoryTree: [],
      footer: { sections: [], links: [] },
      menu: [],
      error: "Could not load content.",
      errors: {
        hero: "Could not load content.",
        banners: "Could not load content.",
        categories: "Could not load content.",
        categoryTree: "Could not load content.",
        footer: "Could not load content.",
        menu: "Could not load content.",
      },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    content.value = errorValue();
  });

  const cases = [
    [
      "HeroBanner",
      <HeroBanner key="hero" />,
      "Live hero content is unavailable — showing the default slide.",
    ],
    ["CategorySlider", <CategorySlider key="slider" />, "Categories are temporarily unavailable."],
    ["BannerLayout", <BannerLayout key="layout" />, "Promotions are temporarily unavailable."],
    [
      "PromoBannerCarousel",
      <PromoBannerCarousel key="promo" />,
      "Promotional offers are temporarily unavailable.",
    ],
    ["Footer", <Footer key="footer" />, "Footer links are temporarily unavailable."],
    ["HoverNav", <HoverNav key="hover-nav" />, "Navigation is temporarily unavailable."],
    ["DynamicMenu", <DynamicMenu key="dynamic-menu" />, "Navigation is temporarily unavailable."],
    [
      "BrowseCategoriesMenu",
      <BrowseCategoriesMenu key="browse" />,
      "Categories are temporarily unavailable.",
    ],
    [
      "MobileMenu",
      <MobileMenu key="mobile" isOpen onClose={vi.fn()} isLoggedIn={false} onLogin={vi.fn()} />,
      "Categories are temporarily unavailable.",
    ],
  ];

  it.each(cases)("%s shows its error state", (_name, element, message) => {
    render(element);

    expect(screen.getByText(message)).toBeVisible();
  });

  it("HeroBanner still renders its emergency slide on error", () => {
    render(<HeroBanner />);

    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

describe("a failed collection only affects its own surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    content.value = contentValue();
  });

  it("renders the hero when only the menu fetch failed", () => {
    content.value = contentValue({
      menu: [],
      errors: { ...NO_ERRORS, menu: "menu offline" },
    });
    render(<HeroBanner />);

    expect(screen.getByRole("heading", { name: "Live Hero Title" })).toBeVisible();
    expect(screen.queryByText(/Live hero content is unavailable/)).toBeNull();
  });

  it("renders the footer when only the hero fetch failed", () => {
    content.value = contentValue({
      hero: [],
      errors: { ...NO_ERRORS, hero: "hero offline" },
    });
    render(<Footer />);

    expect(screen.getByText("Track My Order")).toBeVisible();
    expect(screen.queryByText("Footer links are temporarily unavailable.")).toBeNull();
  });

  it("does not show the fallback hero slide while the context is still loading", () => {
    content.value = contentValue({ hero: [], loading: true });
    const { rerender } = render(<HeroBanner />);

    expect(screen.queryByRole("heading", { name: "Upgrade Your Everyday" })).toBeNull();

    content.value = contentValue({ hero: [], loading: false });
    rerender(<HeroBanner />);

    expect(screen.getByRole("heading", { name: "Upgrade Your Everyday" })).toBeVisible();
  });
});

describe("storefront surfaces show explicit empty states", () => {
  beforeEach(() => {
    content.value = contentValue({
      banners: [],
      categories: [],
      categoryTree: [],
      footer: { sections: [], links: [] },
      menu: [],
    });
  });

  it("uses visible empty copy instead of rendering nothing", () => {
    render(
      <>
        <CategorySlider />
        <BannerLayout />
        <Footer />
        <BrowseCategoriesMenu />
      </>
    );

    expect(screen.getAllByText("No categories to show yet.")).toHaveLength(2);
    expect(screen.getByText("No promotions to show yet.")).toBeVisible();
    expect(screen.getByText("No footer links configured yet.")).toBeVisible();
  });

  it("shows empty copy for the promo carousel and both navigation surfaces", () => {
    render(
      <>
        <PromoBannerCarousel />
        <HoverNav />
        <DynamicMenu />
      </>
    );

    expect(screen.getByText("No promotional offers to show yet.")).toBeVisible();
    expect(screen.getAllByText("No navigation items configured yet.")).toHaveLength(2);
  });
});
