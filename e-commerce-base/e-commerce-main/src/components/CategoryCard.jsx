import { motion } from "framer-motion";
import { Link } from "react-router-dom";

function CategoryCard({ category, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
    >
      <Link
        to={`/products?category=${encodeURIComponent(category.name)}`}
        className="group card-shine relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[2rem] border border-white/30 p-6 text-white shadow-2xl"
      >
        <img src={category.image} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
        <div className="relative z-10 space-y-3">
          <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-[0.24em] uppercase">Explore</span>
          <h3 className="font-display text-2xl">{category.name}</h3>
          <p className="max-w-xs text-sm text-slate-200">{category.description}</p>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)]">
            Shop collection
            <span aria-hidden="true">+</span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export default CategoryCard;
