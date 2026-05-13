import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { orderApi } from "../services/api";
import { formatCurrency } from "../utils/format";

function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      orderApi.list(user.id)
        .then((data) => setOrders(data.orders || []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="glass-panel rounded-[2.5rem] px-6 py-12 text-center">
        <p className="text-sm text-[var(--color-text-soft)]">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="glass-panel rounded-[2.5rem] px-6 py-12 text-center sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Orders</p>
        <h1 className="section-title mt-3 text-4xl">No orders yet</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--color-text-soft)]">
          Once you complete a purchase, your order history will appear here.
        </p>
        <Link to="/products" className="mt-8 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--color-secondary)]">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-[2.5rem] px-6 py-8 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Order history</p>
        <h1 className="section-title mt-2 text-4xl">Your purchases</h1>
        <p className="mt-2 text-sm text-[var(--color-text-soft)]">Balance: {formatCurrency(user?.balance || 0)}</p>
      </section>

      <div className="space-y-4">
        {orders.map((order, idx) => (
          <motion.article
            key={order._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-panel rounded-[2rem] p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-soft)]">
                  {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="mt-1 font-display text-xl">Order #{order._id.slice(-8)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  order.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                  order.status === "failed" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {order.status}
                </span>
                <span className="text-xl font-bold">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/70 px-3 py-2 text-sm">
                  {item.image && <img src={item.image} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span>{item.name}</span>
                  <span className="text-[var(--color-text-soft)]">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

export default Orders;
