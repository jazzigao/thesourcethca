import { Link, useLocation } from "wouter";
import { BriefcaseBusiness, Home, ShoppingBag, Sun, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { useAuth } from "@workspace/replit-auth-web";
import sourceEmblem from "@/assets/source-emblem.webp";

export function Navbar() {
  const { items, setIsCartOpen, setAgeVerified, setJurisdictionConfirmed } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const isActive = (route: string) => route === "/" ? location === "/" : location.startsWith(route);

  return (
    <header className="site-header sticky top-0 z-[100]">
      <div className="announcement-banner" aria-label="New member offer and free shipping announcement">
        <div className="announcement-track">
          <span className="announcement-item">FREE SHIPPING ON ALL ORDERS OVER $100 !    NEW MEMBERS: 10% OFF FIRST PURCHASE ON SIGN UP</span>
        </div>
      </div>
      <div className="site-brand-row">
        <Link
          href="/"
          className="site-brand-link"
          aria-label="Return to The Source entry page"
          data-testid="link-brand-home"
          onClick={() => {
            setAgeVerified(false);
            setJurisdictionConfirmed(false);
          }}
        >
          <img src={sourceEmblem} alt="" className="source-logo source-logo--nav" />
          <span className="sr-only">The Source</span>
          <span className="site-brand-copy">
            <strong>THE SOURCE</strong>
            <span>Seed Grown: Farm to Table.</span>
            <span>Pure Solventless Hash Rosin.</span>
            <span>Farm Bill Compliant THCA Rosin &amp; Flower.</span>
          </span>
        </Link>
        <div className="site-account-tools">
          <Link href="/account" className="account-link" data-testid="link-account">
            <User className="h-3.5 w-3.5" />
            {isAuthenticated ? user?.firstName || "My Account" : "My Account"}
          </Link>
          {isAuthenticated ? (
            <button type="button" onClick={logout} className="account-link" data-testid="button-logout">Log Out</button>
          ) : null}
        </div>
      </div>
      <nav className="desktop-menu" aria-label="Primary navigation">
        <Link href="/" className={`menu-link ${isActive("/") ? "menu-link--active" : ""}`} data-testid="link-home">
          <Home aria-hidden="true" /> <span>Home</span>
        </Link>
        <Link href="/shop" className={`menu-link ${isActive("/shop") ? "menu-link--active" : ""}`} data-testid="link-drops">
          <Sun aria-hidden="true" /> <span>Drops</span>
        </Link>
        <button type="button" className="menu-link" onClick={() => setIsCartOpen(true)} aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`} data-testid="button-cart">
          <ShoppingBag aria-hidden="true" /> <span>Cart</span>
          {itemCount > 0 ? <b className="cart-count">{itemCount}</b> : null}
        </button>
        <Link href="/wholesale" className={`menu-link ${isActive("/wholesale") ? "menu-link--active" : ""}`} data-testid="link-wholesale">
          <BriefcaseBusiness aria-hidden="true" /> <span>Wholesale</span>
        </Link>
      </nav>
    </header>
  );
}
