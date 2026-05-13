import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { orderApi } from "../services/api";
import { formatCurrency } from "../utils/format";

function Checkout() {
  const { cart, subtotal, shipping, taxes, total, clearCart } = useStore();
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState({
    firstName: "", lastName: "", street: "", city: "", postalCode: "", country: "", phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (field) => (e) => setAddress((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return navigate("/login");
    if (cart.length === 0) return;

    // Validate address
    if (!address.firstName || !address.street || !address.city) {
      setError("Please fill in the required address fields");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const items = cart.map((item) => ({
        productId: item.id || item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.images?.[0] || "",
      }));

      await orderApi.create({
        userId: user.id,
        items,
        totalAmount: total,
        shippingAddress: address,
      });

      setSuccess(true);
      clearCart();
      await refreshProfile();

      setTimeout(() => navigate("/orders"), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="glass-panel rounded-[2.5rem] px-6 py-12 text-center sm:px-8">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</div>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Order placed</p>
        <h1 className="section-title mt-2 text-4xl">Thank you!</h1>
        <p className="mt-4 text-sm text-[var(--color-text-soft)]">
          Your order is being processed. Payment will be deducted from your balance.
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-soft)]">Redirecting to orders...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="glass-panel rounded-[2.5rem] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Checkout</p>
        <h1 className="section-title mt-2 text-4xl">Complete your order</h1>
        {isAuthenticated && (
          <p className="mt-3 text-sm text-[var(--color-text-soft)]">
            Your balance: <span className="font-semibold text-emerald-600">{formatCurrency(user?.balance || 0)}</span>
            {user?.balance < total && (
              <span className="ml-2 text-red-500">(Insufficient for this order)</span>
            )}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <div className="space-y-4">
            <h2 className="font-display text-2xl">Shipping address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="First name *" value={address.firstName} onChange={handleChange("firstName")} required />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="Last name" value={address.lastName} onChange={handleChange("lastName")} />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none sm:col-span-2" placeholder="Street address *" value={address.street} onChange={handleChange("street")} required />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="City *" value={address.city} onChange={handleChange("city")} required />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="Postal code" value={address.postalCode} onChange={handleChange("postalCode")} />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="Country" value={address.country} onChange={handleChange("country")} />
              <input className="rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none" placeholder="Phone number" value={address.phone} onChange={handleChange("phone")} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="w-full rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--color-secondary)] disabled:opacity-50"
          >
            {submitting ? "Processing order..." : `Pay ${formatCurrency(total)} from balance`}
          </button>
        </form>
      </section>

      <aside className="glass-panel h-fit rounded-[2.5rem] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Order summary</p>
        {cart.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-text-soft)]">
            Your cart is empty. Visit the <Link to="/products" className="font-semibold text-[var(--color-primary)]">shop</Link> to add items.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-[1.5rem] border border-[var(--color-border)] bg-white/70 p-3">
                <img src={item.images[0]} alt={item.name} className="h-16 w-16 rounded-[1rem] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-sm text-[var(--color-text-soft)]">Qty {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatCurrency(item.quantity * item.price)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-4 border-t border-[var(--color-border)] pt-6 text-sm">
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Shipping</span><span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span></div>
          <div className="flex items-center justify-between"><span className="text-[var(--color-text-soft)]">Estimated tax</span><span>{formatCurrency(taxes)}</span></div>
          <div className="flex items-center justify-between text-lg font-semibold"><span>Total</span><span>{formatCurrency(total)}</span></div>
        </div>
      </aside>
    </div>
  );
}

export default Checkout;
