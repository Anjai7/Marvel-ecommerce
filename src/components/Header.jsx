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
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { addToast } = useToast();
  let cartItems = [];
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- unconditional call; try/catch only guards missing CartProvider in isolated tests
    const cart = useCart();
    if (cart && Array.isArray(cart.items)) cartItems = cart.items;
  } catch {
    cartItems = [];
  }

  const userRole = currentUser?.role || "user";
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
        <button
          className="logo"
          onClick={onNavigateHome}
          id="logo"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
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
                    <AvatarFallback
                      style={{
                        background:
                          userRole === "super_admin"
                            ? "#d97706"
                            : userRole === "vendor"
                              ? "#7c3aed"
                              : userRole === "admin"
                                ? "#0284c7"
                                : "#2563eb",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div
                      className="ha-sub"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      Hello, {currentUser?.full_name?.split(" ")[0] || "User"}
                    </div>
                    <div
                      className="ha-label"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: 8,
                          background:
                            userRole === "super_admin"
                              ? "#f59e0b"
                              : userRole === "vendor"
                                ? "#8b5cf6"
                                : userRole === "admin"
                                  ? "#0284c7"
                                  : "#3b82f6",
                          color: "#fff",
                        }}
                      >
                        {userRole.replace("_", " ").toUpperCase()}
                      </span>
                      ▾
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" style={{ width: 230 }}>
                <DropdownMenuLabel>
                  <div style={{ fontWeight: 800 }}>{currentUser?.full_name}</div>
                  <div style={{ fontSize: 11, color: "var(--gray-500)", fontWeight: 400 }}>
                    {currentUser?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Role Workspace Link */}
                {userRole === "super_admin" && (
                  <DropdownMenuItem
                    icon={<Zap size={16} color="#d97706" />}
                    onClick={onNavigateAdmin}
                    style={{ fontWeight: 700, color: "#b45309" }}
                  >
                    Super Admin Hub
                  </DropdownMenuItem>
                )}

                {userRole === "admin" && (
                  <DropdownMenuItem
                    icon={<ShieldCheck size={16} color="#0284c7" />}
                    onClick={onNavigateAdmin}
                    style={{ fontWeight: 700, color: "#0369a1" }}
                  >
                    Admin Operations Console
                  </DropdownMenuItem>
                )}

                {userRole === "vendor" && (
                  <DropdownMenuItem
                    icon={<Store size={16} color="#7c3aed" />}
                    onClick={onNavigateAdmin}
                    style={{ fontWeight: 700, color: "#6b21a8" }}
                  >
                    Vendor Store Hub
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  icon={<Package size={16} color="#2563eb" />}
                  onClick={onNavigateCustomerPortal}
                  style={{ fontWeight: 600 }}
                >
                  My Orders & Deliveries
                </DropdownMenuItem>

                <DropdownMenuItem
                  icon={<Heart size={16} color="#ef4444" />}
                  onClick={onNavigateCustomerPortal}
                  style={{ fontWeight: 600 }}
                >
                  Saved Wishlist
                </DropdownMenuItem>

                <DropdownMenuItem icon={<Settings size={16} />} onClick={onNavigateCustomerPortal}>
                  Account Settings
                </DropdownMenuItem>

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
                className="signup-btn"
                onClick={onNavigateSignUp}
                style={{ fontSize: 13 }}
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
                <div className="ha-icon" style={{ position: "relative" }}>
                  <ShoppingBag size={22} />
                  <Badge variant="accent" size="sm" className="cart-badge">
                    {cartCount}
                  </Badge>
                </div>
                <div className="ha-label">Cart ▾</div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" style={{ width: 280, padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>My Shopping Cart</span>
                <Badge variant="secondary" size="sm">
                  {cartCount} items
                </Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 14 }}>
                Items in your cart qualify for <strong>FREE Express Shipping</strong>!
              </div>
              {cartItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 14 }}>
                  Your cart is empty.
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  {cartItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 170,
                          }}
                        >
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gray-600)" }}>
                          Qty {item.quantity} · {formatCurrency(item.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {cartItems.length > 3 && (
                    <div style={{ fontSize: 12, color: "var(--gray-600)" }}>
                      +{cartItems.length - 3} more…
                    </div>
                  )}
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                style={{ width: "100%", marginBottom: 8 }}
                onClick={onNavigateCart}
              >
                View Cart
              </Button>
              <Button variant="accent" size="sm" style={{ width: "100%" }} onClick={onNavigateCart}>
                Proceed to Checkout
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
