import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useStore } from "../context/StoreContext";
import { formatCurrency } from "../utils/format";

const sortOptions = {
  featured: "Featured first",
  priceAsc: "Price: low to high",
  priceDesc: "Price: high to low",
  rating: "Highest rated",
};

function Products() {
  const { products } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [maxPrice, setMaxPrice] = useState(searchParams.get("price") ?? "1500");
  const deferredSearch = useDeferredValue(searchParams.get("search") ?? "");

  const selectedCategory = searchParams.get("category") ?? "All";
  const selectedRating = Number(searchParams.get("rating") ?? 0);
  const selectedSort = searchParams.get("sort") ?? "featured";

  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.category))], [products]);

  const filteredProducts = useMemo(() => {
    const search = deferredSearch.toLowerCase();
    const priceLimit = Number(maxPrice);

    const filtered = products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search);
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesRating = product.rating >= selectedRating;
      const matchesPrice = product.price <= priceLimit;

      return matchesSearch && matchesCategory && matchesRating && matchesPrice;
    });

    return filtered.sort((left, right) => {
      if (selectedSort === "priceAsc") return left.price - right.price;
      if (selectedSort === "priceDesc") return right.price - left.price;
      if (selectedSort === "rating") return right.rating - left.rating;
      return Number(right.featured) - Number(left.featured);
    });
  }, [deferredSearch, maxPrice, products, selectedCategory, selectedRating, selectedSort]);

  const updateParam = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === "All" || value === "0") {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-[2.5rem] px-6 py-8 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Product listing</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="section-title text-4xl sm:text-5xl">Find the setup that fits your pace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-soft)] sm:text-base">
              Filter by category, budget, and rating to explore a deliberately curated collection instead of an endless catalog.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-white/70 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--color-text-soft)]">Results</p>
            <p className="mt-1 font-display text-3xl">{filteredProducts.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="glass-panel h-fit rounded-[2rem] p-5">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold">Category</label>
              <select value={selectedCategory} onChange={(event) => updateParam("category", event.target.value)} className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-3 outline-none">
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priceRange" className="text-sm font-semibold">Price cap: {formatCurrency(Number(maxPrice))}</label>
              <input id="priceRange" type="range" min="50" max="1500" step="10" value={maxPrice} onChange={(event) => {
                const value = event.target.value;
                setMaxPrice(value);
                updateParam("price", value);
              }} className="mt-4 w-full accent-[var(--color-primary)]" />
            </div>

            <div>
              <label className="text-sm font-semibold">Minimum rating</label>
              <select value={selectedRating} onChange={(event) => updateParam("rating", event.target.value)} className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-3 outline-none">
                <option value="0">All ratings</option>
                <option value="4">4.0+</option>
                <option value="4.5">4.5+</option>
                <option value="4.8">4.8+</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold">Sort by</label>
              <select value={selectedSort} onChange={(event) => updateParam("sort", event.target.value)} className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-3 outline-none">
                {Object.entries(sortOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          {deferredSearch ? (
            <p className="text-sm text-[var(--color-text-soft)]">
              Search results for <span className="font-semibold text-[var(--color-text)]">{deferredSearch}</span>
            </p>
          ) : null}
          <motion.div layout className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </motion.div>
          {filteredProducts.length === 0 ? (
            <div className="glass-panel rounded-[2rem] px-6 py-10 text-center">
              <h2 className="font-display text-2xl">No products match this filter set</h2>
              <p className="mt-3 text-sm text-[var(--color-text-soft)]">Try widening the price cap or switching back to all categories.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Products;
