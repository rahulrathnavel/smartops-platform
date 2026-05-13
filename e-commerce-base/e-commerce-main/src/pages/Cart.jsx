import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { formatCurrency } from "../utils/format";

function Cart() {
  const { cart, subtotal, shipping, taxes, total, updateQuantity, removeFromCart } = useStore();

  if (cart.length === 0) {
    return (
      <div className="glass-panel rounded-[2.5rem] px-6 py-12 text-center sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Cart</p>
        <h1 className="section-title mt-3 text-4xl">Your cart is waiting for a first pick</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--color-text-soft)]">
          Browse the catalog and add a few standout products to see the checkout flow and pricing summary come to life.
        </p>
        <Link to="/products" className="mt-8 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--color-secondary)]">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="glass-panel rounded-[2.5rem] p-6 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Cart</p>
          <h1 className="section-title mt-2 text-4xl">Review your selected items</h1>
        </div>

        <div className="mt-8 space-y-4">
          {cart.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-[1.75rem] border border-[var(--color-border)] bg-white/70 p-4 sm:grid-cols-[120px_1fr_auto]">
              <img src={item.images[0]} alt={item.name} className="h-28 w-full rounded-[1.25rem] object-cover sm:w-28" />
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-text-soft)]">{item.category}</p>
                <h2 className="font-display text-2xl">{item.name}</h2>
                <p className="text-sm text-[var(--color-text-soft)]">{item.shortDescription}</p>
                <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-semibold text-[var(--color-warning)]">Remove</button>
              </div>

              <div className="flex flex-col items-start gap-4 sm:items-end">
                <p className="text-2xl font-bold">{formatCurrency(item.price)}</p>
                <div className="flex items-center rounded-full border border-[var(--color-border)] bg-white/75 px-2 py-2">
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-9 w-9 rounded-full text-lg">-</button>
                  <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-9 w-9 rounded-full text-lg">+</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="glass-panel h-fit rounded-[2.5rem] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Summary</p>
        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Shipping</span><span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span></div>
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Estimated tax</span><span>{formatCurrency(taxes)}</span></div>
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-bold">{formatCurrency(total)}</span></div>
          </div>
        </div>

        <Link to="/checkout" className="mt-8 inline-flex w-full justify-center rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--color-secondary)]">
          Continue to checkout
        </Link>
      </aside>
    </div>
  );
}

export default Cart;
