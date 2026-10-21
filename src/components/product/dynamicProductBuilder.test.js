import { describe, expect, it } from "vitest";
import {
  buildDynamicProductDetails,
  deliverySummary,
  reviewSummary,
  userGuideDetails,
} from "./dynamicProductBuilder";

const BARE_PRODUCT = { id: "p1", title: "Trail Running Shoe" };

describe("buildDynamicProductDetails", () => {
  it("returns null when the payload has no product row", () => {
    expect(buildDynamicProductDetails(undefined)).toBeNull();
    expect(buildDynamicProductDetails({})).toBeNull();
    expect(buildDynamicProductDetails({ product: null })).toBeNull();
  });

  it("leaves every unconfigured field empty instead of inventing a value", () => {
    const view = buildDynamicProductDetails({ product: BARE_PRODUCT });

    expect(view).toMatchObject({
      id: "p1",
      name: "Trail Running Shoe",
      brand: null,
      sku: null,
      category: null,
      description: null,
      price: null,
      originalPrice: null,
      discountPercent: null,
      inStock: null,
      stock: null,
      featured: false,
      offerText: null,
      offerEndsAt: null,
      warranty: null,
      seller: null,
      manufacturer: null,
      userGuide: null,
    });

    expect(view.media).toEqual([]);
    expect(view.colors).toEqual([]);
    expect(view.sizes).toEqual([]);
    expect(view.highlights).toEqual([]);
    expect(view.specifications).toEqual([]);
    expect(view.dimensions).toEqual([]);
    expect(view.materials).toEqual([]);
    expect(view.careInstructions).toEqual([]);
    expect(view.certifications).toEqual([]);
    expect(view.inBox).toEqual([]);
    expect(view.deliveryInfo).toEqual({ estimatedDays: null, lines: [] });
    expect(view.offers).toEqual({ emi: [], bank: [], coupon: [] });
    expect(view.reviewSummary).toEqual({ overall: null, total: 0, breakdown: [] });
    expect(view.additionalDetails).toEqual({
      modelNumber: null,
      countryOfOrigin: null,
      hsn: null,
      gst: null,
    });
  });

  it("does not generate a price, a SKU, a discount, a rating or a placeholder image", () => {
    const view = buildDynamicProductDetails({ product: BARE_PRODUCT });

    expect(view.price).toBeNull();
    expect(view.sku).toBeNull();
    expect(view.discountPercent).toBeNull();
    expect(view.reviewSummary.overall).toBeNull();
    expect(view.reviewSummary.total).toBe(0);
    expect(JSON.stringify(view)).not.toMatch(/unsplash/i);
    expect(JSON.stringify(view)).not.toMatch(/"MRV-/);
    expect(JSON.stringify(view)).not.toMatch(
      /Midnight Black|Silver Frost|Ocean Navy|Titanium Gold/
    );
    expect(JSON.stringify(view)).not.toMatch(/HDFC|CHASE5|AMEX25|MARVEL10|FIRSTBUY/);
    expect(JSON.stringify(view)).not.toMatch(/Alex Rivera|Sarah Jenkins|David Chen/);
  });

  it("maps the stored product columns as they are", () => {
    const view = buildDynamicProductDetails({
      product: {
        id: "p2",
        title: "Road Shoe",
        brand: "Strider",
        sku: "STR-001",
        category: "Running",
        description: "Lightweight daily trainer.",
        price: "2499.00",
        original_price: "2999.00",
        stock: "4",
        is_featured: true,
        offer_text: "Bank offer available",
        offer_ends_at: "2026-12-31T23:59:59.000Z",
        warranty: "6 months manufacturer warranty",
        vendor_name: "Strider Store",
        highlights: ["Breathable mesh", "Reflective heel"],
        specifications: [
          {
            category: "Upper",
            items: [{ label: "Material", value: "Engineered mesh" }],
          },
        ],
        dimensions: { weight: "240 g", drop: "8 mm" },
        materials: [{ part: "Upper", material: "Recycled mesh" }],
        care_instructions: ["Air dry only"],
        certifications: ["BIS registered"],
        in_box: ["1 pair of shoes", "1 drawstring bag"],
        delivery_info: {
          free_shipping: true,
          express_available: true,
          return_days: 7,
          estimated_days: "2-4 business days",
        },
        user_guide: {
          url: "https://cdn.example.com/guide.pdf",
          version: "1.1",
          file_size: "900 KB",
          steps: [{ step: 1, title: "Unbox", desc: "Check the pair." }],
        },
        model_name: "Road Runner 2",
        country_of_origin: "India",
        hsn_code: "64041100",
        gst_rate: "18%",
        manufacturer_name: "Strider Manufacturing",
        importer_packer: "Strider Retail",
        manufacturing_date: "2026-08-01",
        manufacturer_address: "Pune, MH",
        support_phone: "+91 20 0000 0000",
        support_email: "care@strider.example",
      },
      reviews: {
        overall: 4.5,
        total: 2,
        breakdown: { 5: 1, 4: 1 },
        items: [{ id: "r1", author_name: "Asha", rating: 5 }],
      },
      offers: [
        {
          kind: "emi",
          title: "No cost EMI",
          months: 6,
          amount: "416.50",
          interest: "No Cost",
        },
        { kind: "bank", bank: "Example Bank", description: "10% back", code: "EX10" },
        { kind: "coupon", code: "RUN50", description: "₹50 off" },
        { kind: "unexpected", title: "ignored" },
      ],
      variants: {
        colors: [{ id: "c1", label: "Ink", value: "#0f172a" }],
        sizes: [{ id: "s1", label: "UK 8", value: "8" }],
      },
      media: [
        { id: "m2", url: "https://cdn.example.com/2.jpg", kind: "gallery" },
        { id: "m1", url: "https://cdn.example.com/1.jpg", kind: "hero" },
      ],
    });

    expect(view).toMatchObject({
      brand: "Strider",
      sku: "STR-001",
      category: "Running",
      price: 2499,
      originalPrice: 2999,
      discountPercent: 17,
      inStock: true,
      stock: 4,
      featured: true,
      offerText: "Bank offer available",
      offerEndsAt: "2026-12-31T23:59:59.000Z",
      warranty: "6 months manufacturer warranty",
      seller: { name: "Strider Store" },
    });

    expect(view.media.map((item) => item.url)).toEqual([
      "https://cdn.example.com/2.jpg",
      "https://cdn.example.com/1.jpg",
    ]);
    expect(view.colors).toEqual([{ id: "c1", label: "Ink", value: "#0f172a" }]);
    expect(view.sizes).toEqual([{ id: "s1", label: "UK 8", value: "8" }]);
    expect(view.highlights).toEqual(["Breathable mesh", "Reflective heel"]);
    expect(view.specifications).toEqual([
      { category: "Upper", items: [{ label: "Material", value: "Engineered mesh" }] },
    ]);
    expect(view.dimensions).toEqual([
      { label: "Weight", value: "240 g" },
      { label: "Drop", value: "8 mm" },
    ]);
    expect(view.materials).toEqual([{ part: "Upper", material: "Recycled mesh" }]);
    expect(view.careInstructions).toEqual(["Air dry only"]);
    expect(view.certifications).toEqual(["BIS registered"]);
    expect(view.inBox).toEqual(["1 pair of shoes", "1 drawstring bag"]);
    expect(view.deliveryInfo).toEqual({
      estimatedDays: "2-4 business days",
      lines: ["Free shipping", "Express delivery available", "7-day returns"],
    });
    expect(view.userGuide).toEqual({
      url: "https://cdn.example.com/guide.pdf",
      version: "1.1",
      fileSize: "900 KB",
      steps: [{ step: 1, title: "Unbox", desc: "Check the pair." }],
    });
    expect(view.additionalDetails).toEqual({
      modelNumber: "Road Runner 2",
      countryOfOrigin: "India",
      hsn: "64041100",
      gst: "18%",
    });
    expect(view.manufacturer).toEqual({
      name: "Strider Manufacturing",
      importedBy: "Strider Retail",
      manufacturingDate: "2026-08-01",
      address: "Pune, MH",
      supportPhone: "+91 20 0000 0000",
      supportEmail: "care@strider.example",
    });

    expect(view.offers.emi).toEqual([
      {
        title: "No cost EMI",
        bank: null,
        code: null,
        description: null,
        months: 6,
        amount: 416.5,
        interest: "No Cost",
      },
    ]);
    expect(view.offers.bank).toHaveLength(1);
    expect(view.offers.coupon).toHaveLength(1);
    expect(view.offers).not.toHaveProperty("unexpected");
    expect(view.reviewSummary).toEqual({
      overall: 4.5,
      total: 2,
      breakdown: [
        { stars: 5, count: 1, percent: 50 },
        { stars: 4, count: 1, percent: 50 },
      ],
    });
  });

  it("uses the stored product image as the only frame when the media table is empty", () => {
    const view = buildDynamicProductDetails({
      product: { id: "p3", title: "Shoe", image_url: "https://cdn.example.com/main.jpg" },
      media: [],
    });

    expect(view.media).toEqual([
      {
        id: null,
        url: "https://cdn.example.com/main.jpg",
        type: "image",
        thumb: "https://cdn.example.com/main.jpg",
        kind: "hero",
      },
    ]);
  });

  it("keeps a non-positive discount out of the view model", () => {
    const view = buildDynamicProductDetails({
      product: { id: "p4", title: "Shoe", price: "1000", original_price: "900" },
    });

    expect(view.originalPrice).toBe(900);
    expect(view.discountPercent).toBeNull();
  });
});

describe("reviewSummary", () => {
  it("counts only the stars that occur and derives percentages from the total", () => {
    expect(reviewSummary({ overall: 4, total: 3, breakdown: { 5: 1, 3: 2 } })).toEqual({
      overall: 4,
      total: 3,
      breakdown: [
        { stars: 5, count: 1, percent: 33 },
        { stars: 3, count: 2, percent: 67 },
      ],
    });
  });

  it("returns an empty summary instead of a fabricated one", () => {
    expect(reviewSummary(undefined)).toEqual({ overall: null, total: 0, breakdown: [] });
  });
});

describe("deliverySummary", () => {
  it("only reports promises the stored value makes", () => {
    expect(deliverySummary(null)).toEqual({ estimatedDays: null, lines: [] });
    expect(deliverySummary({})).toEqual({ estimatedDays: null, lines: [] });
    expect(deliverySummary({ free_shipping: false })).toEqual({
      estimatedDays: null,
      lines: [],
    });
  });

  it("accepts a plain list of delivery lines", () => {
    expect(deliverySummary(["Ships in 3 days"])).toEqual({
      estimatedDays: null,
      lines: ["Ships in 3 days"],
    });
  });
});

describe("userGuideDetails", () => {
  it("returns null when the guide column is empty", () => {
    expect(userGuideDetails(null)).toBeNull();
    expect(userGuideDetails({})).toBeNull();
  });
});
