import React from "react";
import { render, screen, act } from "@testing-library/react";
import { CartProvider, useCart, normalizeProduct } from "./CartContext";
import { AuthContext } from "./AuthContext";

const STORAGE_KEY = "marvel_cart";

function Harness({ onCart }) {
  const cart = useCart();
  onCart(cart);
  return (
    <div>
      <span data-testid="count">{cart.cartCount}</span>
      <span data-testid="subtotal">{cart.subtotal}</span>
      <span data-testid="savings">{cart.savings}</span>
      <span data-testid="total">{cart.total}</span>
      <span data-testid="items">{JSON.stringify(cart.items)}</span>
    </div>
  );
}

let latest = null;
const capture = (cart) => {
  latest = cart;
};

function setup() {
  latest = null;
  render(
    <CartProvider>
      <Harness onCart={capture} />
    </CartProvider>
  );
  return () => latest;
}

const productA = {
  id: "a",
  title: "Alpha Headphones",
  price: 100,
  original_price: 150,
  image_url: "https://example.com/a.png",
  category: "audio",
};

const productB = { id: "b", name: "Beta Speaker", price: 50 };

beforeEach(() => {
  localStorage.clear();
  latest = null;
});

describe("CartContext", () => {
  it("normalizeProduct applies fallbacks", () => {
    expect(normalizeProduct(productA)).toEqual({
      id: "a",
      title: "Alpha Headphones",
      price: 100,
      originalPrice: 150,
      image: "https://example.com/a.png",
      category: "audio",
      sku: null,
      combination_id: null,
      options: [],
    });
    const normalized = normalizeProduct(productB);
    expect(normalized.id).toBe("b");
    expect(normalized.title).toBe("Beta Speaker");
    expect(normalized.price).toBe(50);
    expect(normalized.originalPrice).toBeNull();
    expect(normalized.image).toContain("unsplash");
    expect(normalized.category).toBe("");
    expect(normalizeProduct({}).title).toBe("Product");
  });

  it("addItem adds and increments quantity for same id", () => {
    const get = setup();
    act(() => {
      get().addItem(productA);
    });
    expect(JSON.parse(screen.getByTestId("items").textContent)).toHaveLength(1);
    expect(screen.getByTestId("count").textContent).toBe("1");

    act(() => {
      get().addItem(productA, 2);
    });
    const items = JSON.parse(screen.getByTestId("items").textContent);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("updateQuantity clamps to >= 1 and ignores unknown ids", () => {
    const get = setup();
    act(() => {
      get().addItem(productA, 2);
    });
    act(() => {
      get().updateQuantity("a", 5);
    });
    expect(JSON.parse(screen.getByTestId("items").textContent)[0].quantity).toBe(5);

    act(() => {
      get().updateQuantity("a", 0);
    });
    expect(JSON.parse(screen.getByTestId("items").textContent)[0].quantity).toBe(1);

    const before = screen.getByTestId("items").textContent;
    act(() => {
      get().updateQuantity("unknown", 9);
    });
    expect(screen.getByTestId("items").textContent).toBe(before);
  });

  it("removeItem removes and clearCart empties", () => {
    const get = setup();
    act(() => {
      get().addItem(productA);
      get().addItem(productB);
    });
    expect(JSON.parse(screen.getByTestId("items").textContent)).toHaveLength(2);

    act(() => {
      get().removeItem("a");
    });
    let items = JSON.parse(screen.getByTestId("items").textContent);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("b");

    act(() => {
      get().clearCart();
    });
    expect(JSON.parse(screen.getByTestId("items").textContent)).toHaveLength(0);
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("derives cartCount, subtotal, savings, and total", () => {
    const get = setup();
    act(() => {
      get().addItem(productA, 2); // 100 x2, savings (150-100) x2 = 100
      get().addItem(productB, 1); // 50 x1, no savings
    });
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.getByTestId("subtotal").textContent).toBe("250");
    expect(screen.getByTestId("savings").textContent).toBe("100");
    expect(screen.getByTestId("total").textContent).toBe("250");
  });

  it("persists to localStorage across remount", () => {
    const get = setup();
    act(() => {
      get().addItem(productA, 2);
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].quantity).toBe(2);

    // Remount with a fresh provider should restore from localStorage
    latest = null;
    render(
      <CartProvider>
        <Harness onCart={capture} />
      </CartProvider>
    );
    const items = JSON.parse(screen.getAllByTestId("items")[1].textContent);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("a");
    expect(items[0].quantity).toBe(2);
  });

  it("restores user-scoped cart on login and clears it on logout", () => {
    const userA = { id: 101, email: "alice@example.com" };
    const userStorageKey = `marvel_cart_user_${userA.id}`;

    // Pre-seed userA's cart in localStorage
    localStorage.setItem(
      userStorageKey,
      JSON.stringify([{ ...productA, lineId: "a::", quantity: 3 }])
    );

    let authValue = { isLoggedIn: true, user: userA };
    const MockAuthProvider = ({ children }) => (
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    );

    const { rerender } = render(
      <MockAuthProvider>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </MockAuthProvider>
    );

    // Should load alice's pre-seeded cart
    expect(screen.getByTestId("count").textContent).toBe("3");

    // Alice logs out
    authValue = { isLoggedIn: false, user: null };
    rerender(
      <MockAuthProvider>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </MockAuthProvider>
    );

    // Cart is now empty on logout
    expect(screen.getByTestId("count").textContent).toBe("0");

    // Alice logs back in
    authValue = { isLoggedIn: true, user: userA };
    rerender(
      <MockAuthProvider>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </MockAuthProvider>
    );

    // Alice's cart is restored
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("lets a guest add to a local cart", () => {
    const authValue = { isLoggedIn: false, user: null };
    render(
      <AuthContext.Provider value={authValue}>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </AuthContext.Provider>
    );

    act(() => {
      expect(latest.addItem(productA, 1)).toBe(true);
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toHaveLength(1);
  });

  it("folds the guest cart into the account cart on login", () => {
    const user = { id: 7, email: "buyer@example.com" };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...productA, lineId: "a::", quantity: 2 }])
    );
    localStorage.setItem(
      `marvel_cart_user_${user.id}`,
      JSON.stringify([{ ...productB, lineId: "b::", quantity: 1 }])
    );

    let authValue = { isLoggedIn: false, user: null };
    const Auth = ({ children }) => (
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    );
    const { rerender } = render(
      <Auth>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </Auth>
    );
    expect(screen.getByTestId("count").textContent).toBe("2");

    authValue = { isLoggedIn: true, user };
    rerender(
      <Auth>
        <CartProvider>
          <Harness onCart={capture} />
        </CartProvider>
      </Auth>
    );

    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(`marvel_cart_user_${user.id}`))).toHaveLength(2);
  });
});
