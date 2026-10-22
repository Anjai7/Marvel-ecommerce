/**
 * Starter presets for new CMS pages.
 *
 * When an admin creates a page, picking a preset pre-fills sensible sections
 * with placeholder data so the page is ready to customize immediately rather
 * than staring at an empty slate.
 */

export const PAGE_STARTER_PRESETS = [
  {
    id: "landing",
    name: "Promotional Landing Page",
    description: "High-impact hero, featured product grid, promo banner, FAQs, and a closing CTA.",
    badge: "Most Popular",
    kind: "landing",
    template: "landing",
    sections: [
      {
        type: "hero",
        data: {
          heading: "Exclusive Marvel Drop",
          eyebrow: "Limited Edition",
          subheading: "Explore premium collectibles, superhero apparel, and official accessories.",
          cta_label: "Shop the Collection",
          cta_href: "#/category/apparel",
          theme: "gradient",
        },
      },
      {
        type: "product_grid",
        data: {
          limit: 8,
          columns: 4,
          layout: "grid",
          show_price: true,
        },
      },
      {
        type: "promo_banner",
        data: {
          title: "Members Get 20% Off Orders Over $75",
          badge: "Special Offer",
          subtitle: "Use code MARVEL20 at checkout for instant member savings.",
          cta_label: "Join Free",
          cta_href: "#/login",
          theme: "primary",
        },
      },
      {
        type: "faq",
        data: {
          items: [
            {
              question: "Are these items officially licensed Marvel merchandise?",
              answer:
                "Yes, every product in our catalog is 100% authentic and officially licensed by Marvel.",
            },
            {
              question: "How long does shipping take?",
              answer:
                "Standard shipping takes 3-5 business days. Express next-day shipping is available at checkout.",
            },
          ],
        },
      },
      {
        type: "cta",
        data: {
          heading: "Ready to assemble your collection?",
          body: "Join thousands of Marvel fans worldwide and enjoy priority access to all new drops.",
          button_label: "Explore All Products",
          button_href: "#/products",
          align: "center",
        },
      },
    ],
  },
  {
    id: "showcase",
    name: "Product & Category Showcase",
    description: "Hero banner with category tiles and a product carousel for catalog browsing.",
    badge: "Commerce",
    kind: "campaign",
    template: "standard",
    sections: [
      {
        type: "hero",
        data: {
          heading: "Featured Collections",
          eyebrow: "Season Highlights",
          subheading: "Browse superhero gear by team, universe, and character.",
          cta_label: "Browse Categories",
          cta_href: "#/category/all",
          theme: "dark",
        },
      },
      {
        type: "category_grid",
        data: {
          columns: 3,
          limit: 6,
        },
      },
      {
        type: "product_grid",
        data: {
          limit: 12,
          columns: 4,
          layout: "carousel",
          show_price: true,
        },
      },
    ],
  },
  {
    id: "about",
    name: "About & Brand Story",
    description: "Tell your store's story with formatted markdown, photo galleries, and values.",
    badge: "Story",
    kind: "about",
    template: "standard",
    sections: [
      {
        type: "hero",
        data: {
          heading: "Our Marvel Universe",
          eyebrow: "About Us",
          subheading:
            "Built by superfans, for superfans. Bringing the MCU and classic comics to life.",
          theme: "light",
        },
      },
      {
        type: "richtext",
        data: {
          body: "### Born from Passion\n\nWe started Marvel E-Commerce with a simple mission: build the ultimate destination for Marvel fans to discover premium collectibles, movie replicas, and daily superhero wear.\n\n- **100% Authentic**: Licensed directly from official studios.\n- **Crafted with Care**: Museum-grade quality packaging and collectibles.\n- **Global Community**: Over 100,000 satisfied fans across 45 countries.",
          align: "left",
        },
      },
      {
        type: "cta",
        data: {
          heading: "Have questions about our collections?",
          body: "Our support heroes are ready to help you find the perfect piece.",
          button_label: "Contact Support",
          button_href: "#/pages/contact",
          align: "center",
        },
      },
    ],
  },
  {
    id: "faq_hub",
    name: "FAQ & Help Center",
    description: "Clean Q&A accordions with support contact information.",
    badge: "Support",
    kind: "faq",
    template: "standard",
    sections: [
      {
        type: "hero",
        data: {
          heading: "Frequently Asked Questions",
          eyebrow: "Help & Support",
          subheading:
            "Everything you need to know about ordering, shipping, returns, and authenticity.",
          theme: "light",
        },
      },
      {
        type: "faq",
        data: {
          items: [
            {
              question: "What is your return policy?",
              answer:
                "We offer hassle-free 30-day returns on all unopened and unworn items in original packaging.",
            },
            {
              question: "Do you ship internationally?",
              answer: "Yes, we ship to over 50 countries with tracked worldwide courier delivery.",
            },
            {
              question: "How can I track my order?",
              answer:
                "Once your package dispatches, you will receive a tracking link via email and in your account dashboard.",
            },
          ],
        },
      },
      {
        type: "cta",
        data: {
          heading: "Still need help?",
          body: "Our team answers within 24 hours Monday through Friday.",
          button_label: "Get in Touch",
          button_href: "#/pages/contact",
          align: "center",
        },
      },
    ],
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start with an empty page and add your own sections from scratch.",
    badge: "Custom",
    kind: "landing",
    template: "standard",
    sections: [],
  },
];
