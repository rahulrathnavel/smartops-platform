function Footer() {
  return (
    <footer className="px-4 pb-8 sm:px-6 lg:px-8">
      <div className="glass-panel mesh-bg noise-overlay relative mx-auto grid max-w-7xl gap-10 overflow-hidden rounded-[2rem] px-6 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.8fr_0.8fr_1fr]">
        <div className="relative z-10 space-y-4">
          <div>
            <p className="font-display text-2xl">ammazone</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--color-text-soft)]">
              A premium storefront concept focused on calm discovery, expressive motion, and real-world responsiveness.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-soft)]">
            Built with React, Tailwind, Router, and motion-first UI craft.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Shop</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li>Featured Drops</li>
            <li>Audio</li>
            <li>Wearables</li>
            <li>Home Tech</li>
          </ul>
        </div>

        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Company</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li>About</li>
            <li>Design Values</li>
            <li>Shipping</li>
            <li>Support</li>
          </ul>
        </div>

        <div className="relative z-10 space-y-4">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Newsletter</p>
          <p className="text-sm leading-6 text-[var(--color-text-soft)]">
            Product updates, limited drops, and sharp editorial picks once a week.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input type="email" placeholder="Email address" className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white/75 px-4 py-3 text-sm outline-none" aria-label="Email address" />
            <button className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-secondary)]">Subscribe</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
