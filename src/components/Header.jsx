import { useState } from "react";
import { formatCurrency } from "../lib/currency";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  CommandSearch,
  SimpleTooltip,
  useToast,
  Avatar,
  AvatarFallback,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui";
import {
  User,
  ShoppingBag,
  Package,
  LogOut,
  Heart,
  Settings,
  Menu,
  ShieldCheck,
  Zap,
  Store,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useSettings } from "../context/SettingsContext";
import "./storefront/chrome.css";

export default function Header({
  currentUser,
  isLoggedIn,
  onNavigateLogin,
  onNavigateSignUp,
  onNavigateAdmin,
  onNavigateCustomerPortal,
  onNavigateHome,
  onLogout,
  cartCount,
  onMenuOpen,
  onSelectProduct,
  onNavigateCart = () => {},
  onNavigateRoute,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { addToast } = useToast();
  const { settings } = useSettings();
  let cartItems = [];
  let cartSubtotal = 0;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- unconditional call; try/catch only guards missing CartProvider in isolated tests
    const cart = useCart();
    if (cart && Array.isArray(cart.items)) cartItems = cart.items;
    cartSubtotal = Number(cart?.subtotal) || 0;
  } catch {
    cartItems = [];
  }

  // The free-shipping claim is only shown when the cart actually qualifies,
  // using the backend's threshold and country.
  const freeThreshold = Number(settings?.shipping?.free_threshold);
  const storeCountry = typeof settings?.store?.country === "string" ? settings.store.country : "";
  const qualifiesForFreeShipping =
    cartItems.length > 0 &&
    storeCountry !== "" &&
    Number.isFinite(freeThreshold) &&
    freeThreshold >= 0 &&
    cartSubtotal >= freeThreshold;

  const userRole = currentUser?.role || "user";
  // Role hues are fixed, so the class lookup replaces a computed inline style.
  const roleKey = ["super_admin", "vendor", "admin"].includes(userRole)
    ? userRole.replace("_", "-")
    : "user";
  const userInitial = currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "U";

  return (
    <header className="header">
      <div className="container header-inner">
        {/* Hamburger (mobile) */}
        <button
          className="hamburger-btn"
          id="hamburger-btn"
          onClick={onMenuOpen}
          aria-label="Open menu"
        >
          <Menu size={22} color="var(--gray-800)" />
        </button>

        {/* Logo */}
        <button className="logo logo-btn" onClick={onNavigateHome} id="logo">
          <img src="/header.png" alt="Marvel Logo" className="logo-img" />
        </button>

        {/* Search with Command/Popover dropdown */}
        <CommandSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectProduct={onSelectProduct}
        />

        {/* Header Actions */}
        <div className="header-actions">
          {/* Account - Logged In vs Logged Out */}
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="header-action" id="account-btn">
                  <Avatar size="sm">
                    <AvatarFallback className={`avatar-role-${roleKey}`}>
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="ha-account-text">
                    <div className="ha-sub ha-row">
                      Hello, {currentUser?.full_name?.split(" ")[0] || "User"}
                    </div>
                    <div className="ha-label ha-row">
                      <span className={`role-badge role-badge-${roleKey}`}>
                        {userRole.replace("_", " ").toUpperCase()}
                      </span>
                      ▾
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="account-menu-content">
                <DropdownMenuLabel>
                  <div className="menu-label-name">{currentUser?.full_name}</div>
                  <div className="menu-label-email">{currentUser?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* 1. SUPER ADMIN: can go anywhere (Super Admin, Admin, Vendor, Storefront) */}
                {userRole === "super_admin" && (
                  <>
                    <DropdownMenuItem
                      icon={<Zap size={16} className="icon-amber" />}
                      onClick={() =>
                        onNavigateRoute ? onNavigateRoute("super-admin") : onNavigateAdmin()
                      }
                      className="menu-item-super-admin"
                    >
                      Super Admin System
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<ShieldCheck size={16} className="icon-sky" />}
                      onClick={() =>
                        onNavigateRoute ? onNavigateRoute("admin") : onNavigateAdmin()
                      }
                      className="menu-item-admin"
                    >
                      Admin Panel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<Store size={16} className="icon-purple" />}
                      onClick={() =>
                        onNavigateRoute ? onNavigateRoute("vendor") : onNavigateAdmin()
                      }
                      className="menu-item-vendor"
                    >
                      Vendor Portal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<ShoppingBag size={16} className="icon-blue" />}
                      onClick={onNavigateHome}
                      className="menu-item-semibold"
                    >
                      Storefront
                    </DropdownMenuItem>
                  </>
                )}

                {/* 2. ADMIN: only navigate store and admin panel, no vendor, no customer orders/wishlist */}
                {userRole === "admin" && (
                  <>
                    <DropdownMenuItem
                      icon={<ShieldCheck size={16} className="icon-sky" />}
                      onClick={() =>
                        onNavigateRoute ? onNavigateRoute("admin") : onNavigateAdmin()
                      }
                      className="menu-item-admin"
                    >
                      Admin Panel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<ShoppingBag size={16} className="icon-blue" />}
                      onClick={onNavigateHome}
                      className="menu-item-semibold"
                    >
                      Storefront
                    </DropdownMenuItem>
                  </>
                )}

                {/* 3. VENDOR: Vendor Portal & Storefront */}
                {userRole === "vendor" && (
                  <>
                    <DropdownMenuItem
                      icon={<Store size={16} className="icon-purple" />}
                      onClick={() =>
                        onNavigateRoute ? onNavigateRoute("vendor") : onNavigateAdmin()
                      }
                      className="menu-item-vendor"
                    >
                      Vendor Portal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<ShoppingBag size={16} className="icon-blue" />}
                      onClick={onNavigateHome}
                      className="menu-item-semibold"
                    >
                      Storefront
                    </DropdownMenuItem>
                  </>
                )}

                {/* 4. CUSTOMER / USER: My Orders, Wishlist, Account Settings */}
                {userRole !== "admin" && userRole !== "super_admin" && userRole !== "vendor" && (
                  <>
                    <DropdownMenuItem
                      icon={<Package size={16} className="icon-blue" />}
                      onClick={onNavigateCustomerPortal}
                      className="menu-item-semibold"
                    >
                      My Orders & Deliveries
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<Heart size={16} className="icon-red" />}
                      onClick={onNavigateCustomerPortal}
                      className="menu-item-semibold"
                    >
                      Saved Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<Settings size={16} />}
                      onClick={onNavigateCustomerPortal}
                    >
                      Account Settings
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<LogOut size={16} />}
                  onClick={() => {
                    onLogout();
                    addToast({
                      title: "Signed Out",
                      message: "You have logged out of your account.",
                      type: "info",
                    });
                  }}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="header-auth-actions">
              <Button
                variant="accent"
                size="sm"
                className="signin-btn"
                id="signin-btn"
                onClick={onNavigateLogin}
                leftIcon={<User size={16} />}
              >
                Sign In
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="signup-btn header-signup-btn"
                onClick={onNavigateSignUp}
              >
                Sign Up
              </Button>
            </div>
          )}

          <div className="header-divider" />

          <SimpleTooltip content="Track orders and returns">
            <button
              type="button"
              className="header-action"
              id="orders-btn"
              onClick={isLoggedIn ? onNavigateCustomerPortal : onNavigateLogin}
            >
              <div className="ha-icon">
                <Package size={20} />
              </div>
              <div>
                <div className="ha-sub">Returns &amp;</div>
                <div className="ha-label">Orders</div>
              </div>
            </button>
          </SimpleTooltip>

          <div className="header-divider" />

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="header-action" id="cart-btn">
                <div className="ha-icon">
                  <ShoppingBag size={22} />
                  <Badge variant="accent" size="sm" className="cart-badge">
                    {cartCount}
                  </Badge>
                </div>
                <div className="ha-label">Cart ▾</div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="cart-popover-content">
              <div className="cart-popover-head">
                <span className="cart-popover-title">My Shopping Cart</span>
                <Badge variant="secondary" size="sm">
                  {cartCount} items
                </Badge>
              </div>
              {qualifiesForFreeShipping && (
                <div className="cart-popover-note">
                  Items in your cart qualify for <strong>FREE Express Shipping</strong> across{" "}
                  {storeCountry}!
                </div>
              )}
              {cartItems.length === 0 ? (
                <div className="cart-popover-note">Your cart is empty.</div>
              ) : (
                <div className="cart-popover-list">
                  {cartItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="cart-popover-item">
                      <img src={item.image} alt={item.title} className="cart-popover-item-img" />
                      <div className="cart-popover-item-text">
                        <div className="cart-popover-item-title">{item.title}</div>
                        <div className="cart-popover-item-meta">
                          Qty {item.quantity} · {formatCurrency(item.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {cartItems.length > 3 && (
                    <div className="cart-popover-item-meta">+{cartItems.length - 3} more…</div>
                  )}
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="cart-popover-btn"
                onClick={onNavigateCart}
              >
                View Cart
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="cart-popover-checkout"
                onClick={onNavigateCart}
              >
                Proceed to Checkout
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
