import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { formatCurrency } from "../utils/format";

function ProductCard({ product, priority = false }) {
  const { addToCart } = useStore();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-panel card-shine group relative flex h-full flex-col overflow-hidden rounded-[2rem] p-4"
    >
      <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-100">
        <img src={product.images[0]} alt={product.name} loading={priority ? "eager" : "lazy"} className="h-64 w-full object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--color-secondary)] backdrop-blur">
          {product.badge}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-2 pb-2 pt-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]">
            <span>{product.category}</span>
            <span>{product.rating} / 5</span>
          </div>
          <Link to={`/products/${product.id}`} className="block">
            <h3 className="font-display text-xl leading-tight transition group-hover:text-[var(--color-primary)]">{product.name}</h3>
          </Link>
          <p className="text-sm leading-6 text-[var(--color-text-soft)]">{product.shortDescription}</p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)]">Price</p>
            <p className="text-2xl font-bold">{formatCurrency(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-[var(--color-secondary)]"
            aria-label={`Add ${product.name} to cart`}
          >
            Add to cart
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default ProductCard;
