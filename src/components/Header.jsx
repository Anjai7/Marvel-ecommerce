import { useState } from "react";
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  HelpCircle,
  Menu,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";

export default function Header({
  isLoggedIn,
  onLogin,
  onLogout,
  cartCount,
  onMenuOpen,
  onSelectProduct,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { addToast } = useToast();

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    onLogin();
    setSignInOpen(false);
    addToast({
      title: "Welcome Back!",
      message: "You have successfully signed into Marvel.",
      type: "success",
    });
  };

  return (
    <>
      {/* Main Header */}
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
          <a className="logo" href="/" id="logo">
            <img src="/logo.png" alt="Logo" className="logo-img" />
          </a>

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
                  <div
                    className="header-action"
                    id="account-btn"
                    style={{ cursor: "pointer" }}
                  >
                    <Avatar size="sm">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="ha-sub">Hello, User</div>
                      <div className="ha-label">Account ▾</div>
                    </div>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={<Package size={16} />}>
                    My Orders & Returns
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<Heart size={16} />}>
                    Saved Wishlist
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<Settings size={16} />}>
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<HelpCircle size={16} />}>
                    Help & Support
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
              <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign In to Marvel</DialogTitle>
                    <DialogDescription>
                      Access your orders, wishlist, and exclusive discounts.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSignInSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6, display: "block" }}>
                        Email Address
                      </label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        leftIcon={<Mail size={16} />}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6, display: "block" }}>
                        Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        leftIcon={<Lock size={16} />}
                        required
                      />
                    </div>

                    <Button type="submit" variant="primary" size="lg" style={{ marginTop: 8 }}>
                      Sign In
                    </Button>

                    <p style={{ fontSize: 12, textAlign: "center", color: "var(--gray-500)", marginTop: 6 }}>
                      Don't have an account?{" "}
                      <span
                        style={{ color: "var(--navy-light)", cursor: "pointer", fontWeight: 600 }}
                        onClick={handleSignInSubmit}
                      >
                        Create one now
                      </span>
                    </p>
                  </form>
                </DialogContent>

                <Button
                  variant="accent"
                  size="sm"
                  className="signin-btn"
                  id="signin-btn"
                  onClick={() => setSignInOpen(true)}
                  leftIcon={<User size={16} />}
                >
                  Sign In
                </Button>
              </Dialog>
            )}

            <div className="header-divider" />

            <SimpleTooltip content="Track orders and returns">
              <div className="header-action" id="orders-btn" style={{ cursor: "pointer" }}>
                <div className="ha-icon">
                  <Package size={20} />
                </div>
                <div>
                  <div className="ha-sub">Returns &amp;</div>
                  <div className="ha-label">Orders</div>
                </div>
              </div>
            </SimpleTooltip>

            <div className="header-divider" />

            <Popover>
              <PopoverTrigger asChild>
                <div className="header-action" id="cart-btn" style={{ cursor: "pointer" }}>
                  <div className="ha-icon" style={{ position: "relative" }}>
                    <ShoppingBag size={22} />
                    <Badge variant="accent" size="sm" className="cart-badge">
                      {cartCount}
                    </Badge>
                  </div>
                  <div className="ha-label">Cart ▾</div>
                </div>
              </PopoverTrigger>
              <PopoverContent align="end" style={{ width: 280, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>My Shopping Cart</span>
                  <Badge variant="secondary" size="sm">{cartCount} items</Badge>
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 14 }}>
                  Items in your cart qualify for <strong>FREE Express Shipping</strong>!
                </div>
                <Button variant="accent" size="sm" style={{ width: "100%" }}>
                  Proceed to Checkout
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>
    </>
  );
}
