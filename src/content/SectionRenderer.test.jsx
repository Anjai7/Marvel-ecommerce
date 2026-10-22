import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionRenderer, SilentUnknownSection, UnknownSection } from "./SectionRenderer";

// The section components are mocked so the test does not depend on their
// internals: it is the renderer that is under test, not the sections.
vi.mock("../sections/HeroSection", () => ({
  default: ({ heading, onNavigate }) => (
    <div data-testid="hero" onClick={onNavigate}>
      {heading}
    </div>
  ),
}));
vi.mock("../sections/RichTextSection", () => ({
  default: () => <div data-testid="richtext" />,
}));
vi.mock("../sections/ImageSection", () => ({
  default: () => <div data-testid="image" />,
}));
vi.mock("../sections/GallerySection", () => ({
  default: () => <div data-testid="gallery" />,
}));
vi.mock("../sections/ProductGridSection", () => ({
  default: () => <div data-testid="product-grid" />,
}));
vi.mock("../sections/CategoryGridSection", () => ({
  default: () => <div data-testid="category-grid" />,
}));
vi.mock("../sections/PromoBannerSection", () => ({
  default: () => <div data-testid="promo-banner" />,
}));
vi.mock("../sections/CtaSection", () => ({
  default: () => <div data-testid="cta" />,
}));
vi.mock("../sections/FaqSection", () => ({
  default: () => <div data-testid="faq" />,
}));
vi.mock("../sections/VideoSection", () => ({
  default: () => <div data-testid="video" />,
}));
vi.mock("../sections/CategoryListingSection", () => ({
  default: () => <div data-testid="category-listing" />,
}));
vi.mock("../sections/SpacerSection", () => ({
  default: () => <div data-testid="spacer" />,
}));

describe("the section renderer", () => {
  beforeEach(() => {
    // An invalid section is reported to the console on purpose.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders a valid section with its component", () => {
    render(<SectionRenderer section={{ type: "hero", data: { heading: "Welcome" } }} />);

    expect(screen.getByTestId("hero")).toHaveTextContent("Welcome");
    expect(screen.queryByTestId("section-fallback")).toBeNull();
  });

  it("renders the fallback for a section whose type is a prototype key", () => {
    const { container } = render(<SectionRenderer section={{ type: "toString", data: {} }} />);

    // The Object constructor must never be rendered as a component.
    expect(container.textContent).not.toContain("[object Object]");
    expect(screen.getByTestId("section-fallback")).toBeVisible();
    expect(screen.getByText("Unsupported section.")).toBeVisible();
    expect(screen.getByText("toString")).toBeVisible();
  });

  it("renders the fallback for an unknown type and does not throw", () => {
    expect(() => render(<SectionRenderer section={{ type: "nope", data: {} }} />)).not.toThrow();

    expect(screen.getByTestId("section-fallback")).toBeVisible();
  });

  it("renders the fallback for an invalid section and does not throw", () => {
    // A hero without its heading is invalid.
    expect(() => render(<SectionRenderer section={{ type: "hero", data: {} }} />)).not.toThrow();

    expect(screen.getByTestId("section-fallback")).toBeVisible();
    expect(screen.getByText("hero.heading is required.")).toBeVisible();
  });

  it("the fallback is invisible in production", () => {
    vi.stubEnv("PROD", true);

    // The production branch renders nothing at all.
    const { container } = render(<SilentUnknownSection />);
    expect(container).toBeEmptyDOMElement();

    // The v1 policy keeps the diagnostic visible in production too — an admin
    // must be able to see that a section is broken.
    render(<UnknownSection type="hero" />);
    expect(screen.getByTestId("section-fallback")).toBeVisible();
  });

  it("forwards onNavigate to the section component", () => {
    const handleNavigate = vi.fn();
    render(
      <SectionRenderer
        section={{ type: "hero", data: { heading: "Welcome" } }}
        onNavigate={handleNavigate}
      />
    );

    screen.getByTestId("hero").click();
    expect(handleNavigate).toHaveBeenCalled();
  });
});
