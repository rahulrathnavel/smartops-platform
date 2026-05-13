import { useEffect, useState, useTransition } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/format";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/products" },
  { label: "Cart", to: "/cart" },
  { label: "Orders", to: "/orders", auth: true },
];

function Navbar() {
  const { cartCount } = useStore();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    startTransition(() => {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
    });
  };

  const visibleNavItems = navItems.filter((item) => !item.auth || isAuthenticated);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="glass-panel mx-auto max-w-7xl rounded-[1.75rem] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 lg:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-lg font-black text-white shadow-lg shadow-blue-500/30">
              a
            </div>
            <div>
              <p className="font-display text-lg leading-none">ammazone</p>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--color-text-soft)]">Curated tech</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white shadow-lg shadow-blue-500/25"
                      : "text-[var(--color-text-soft)] hover:bg-white/60 hover:text-[var(--color-text)]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={submitSearch} className="hidden flex-1 lg:block" role="search">
            <div className="flex items-center rounded-full border border-[var(--color-border)] bg-white/70 px-4">
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search curated gear" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[var(--color-text-soft)]" aria-label="Search products" />
              <button type="submit" className="rounded-full bg-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]">
                {isPending ? "..." : "Search"}
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && (
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
                {formatCurrency(user?.balance || 0)}
              </span>
            )}
            <Link to="/cart" className="relative rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[var(--color-secondary)]">
              Cart
              <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1 text-xs">{cartCount}</span>
            </Link>
            {isAuthenticated ? (
              <button onClick={logout} className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] transition hover:bg-white/60">
                Sign out
              </button>
            ) : (
              <Link to="/login" className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] transition hover:bg-white/60">
                Sign in
              </Link>
            )}
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-full border border-[var(--color-border)] p-3 lg:hidden" aria-expanded={menuOpen} aria-label="Toggle navigation menu">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            </button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-4 lg:hidden" role="search">
          <div className="flex items-center rounded-full border border-[var(--color-border)] bg-white/70 px-4">
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search products" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[var(--color-text-soft)]" aria-label="Search products" />
            <button type="submit" className="text-sm font-semibold text-[var(--color-primary)]">Go</button>
          </div>
        </form>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden lg:hidden">
              <nav className="mt-4 grid gap-2 border-t border-[var(--color-border)] pt-4">
                {visibleNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className="rounded-2xl px-4 py-3 text-sm font-medium text-[var(--color-text-soft)] transition hover:bg-white/60 hover:text-[var(--color-text)]">
                    {item.label}
                  </NavLink>
                ))}
                {isAuthenticated ? (
                  <button onClick={logout} className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-[var(--color-warning)]">
                    Sign out
                  </button>
                ) : (
                  <NavLink to="/login" className="rounded-2xl px-4 py-3 text-sm font-medium text-[var(--color-primary)]">
                    Sign in
                  </NavLink>
                )}
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

export default Navbar;
