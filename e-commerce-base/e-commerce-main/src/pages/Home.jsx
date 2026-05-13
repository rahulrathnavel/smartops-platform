import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import { useStore } from "../context/StoreContext";
import { categories, testimonials } from "../data/products";

const metrics = [
  { label: "5-star reviews", value: "12k+" },
  { label: "Fast dispatch", value: "24h" },
  { label: "Curated brands", value: "80+" },
];

const offers = [
  {
    title: "Creator setup bundle",
    detail: "Save 18% when you pair audio, lighting, and desktop essentials.",
  },
  {
    title: "Express delivery perks",
    detail: "Free shipping over ?500 with carbon-aware routing included.",
  },
];

function Home() {
  const { featuredProducts } = useStore();

  return (
    <div className="space-y-14 pb-6">
      <section className="mesh-bg glass-panel relative overflow-hidden rounded-[2.5rem] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="noise-overlay absolute inset-0" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="space-y-7">
            <div className="inline-flex rounded-full border border-white/40 bg-white/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-secondary)]">
              Future-ready essentials
            </div>
            <div className="space-y-5">
              <h1 className="section-title text-balance max-w-2xl text-4xl leading-none sm:text-5xl lg:text-6xl">
                The modern storefront for people who notice the details.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--color-text-soft)] sm:text-lg">
                Discover a curated tech and lifestyle collection designed with the same intentional polish you expect from a premium SaaS product.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/products" className="rounded-full bg-[var(--color-primary)] px-6 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-[var(--color-secondary)]">
                Explore collection
              </Link>
              <Link to="/checkout" className="rounded-full border border-[var(--color-border)] px-6 py-4 text-center text-sm font-semibold transition hover:bg-white/60">
                Experience checkout
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[1.5rem] border border-white/35 bg-white/55 p-4">
                  <p className="font-display text-2xl">{metric.value}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-soft)]">{metric.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.12 }} className="grid gap-4 sm:grid-cols-2">
            <div className="glass-panel rounded-[2rem] p-4 sm:translate-y-10">
              <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80" alt="Curated technology lifestyle setup" className="h-72 w-full rounded-[1.5rem] object-cover" />
            </div>
            <div className="space-y-4">
              <div className="glass-panel rounded-[2rem] p-4">
                <img src="https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=900&q=80" alt="Premium wearable device" className="h-40 w-full rounded-[1.5rem] object-cover" />
              </div>
              <div className="rounded-[2rem] bg-[var(--color-secondary)] p-6 text-white shadow-2xl shadow-indigo-900/25">
                <p className="text-xs uppercase tracking-[0.3em] text-blue-100">Spotlight drop</p>
                <h2 className="mt-3 font-display text-2xl">Nova 14 Creator Laptop</h2>
                <p className="mt-2 text-sm leading-6 text-blue-100">
                  Built for flow-state work with refined performance and battery that lasts.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Featured products</p>
            <h2 className="section-title mt-2 text-3xl sm:text-4xl">Selected for high-intent teams</h2>
          </div>
          <Link to="/products" className="hidden text-sm font-semibold text-[var(--color-primary)] sm:block">View all products</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featuredProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 2} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Categories</p>
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">Collections with their own visual rhythm</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category, index) => (
            <CategoryCard key={category.name} category={category} index={index} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Promotional offers</p>
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">Benefits that feel premium, not pushy</h2>
          <div className="mt-8 grid gap-4">
            {offers.map((offer) => (
              <div key={offer.title} className="rounded-[1.5rem] border border-[var(--color-border)] bg-white/65 p-5">
                <h3 className="font-display text-xl">{offer.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">{offer.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] p-6 text-white shadow-2xl shadow-blue-500/20 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-100">Why it converts</p>
          <h2 className="section-title mt-2 text-3xl">Designed for clarity at every step</h2>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-blue-100">
            <li>Responsive layouts that keep visual hierarchy intact on mobile and desktop.</li>
            <li>Reusable cards and shared state that make the codebase easier to extend.</li>
            <li>Fast navigation with lazy-loaded routes and efficient filtering flows.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Testimonials</p>
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">What design-minded shoppers are saying</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.article key={testimonial.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.45, delay: index * 0.08 }} className="glass-panel rounded-[2rem] p-6">
              <p className="text-lg leading-8 text-[var(--color-text)]">"{testimonial.quote}"</p>
              <div className="mt-6">
                <p className="font-display text-xl">{testimonial.name}</p>
                <p className="text-sm text-[var(--color-text-soft)]">{testimonial.role}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
