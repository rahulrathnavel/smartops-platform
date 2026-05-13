import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import ProductCard from "../components/ProductCard";
import { useStore } from "../context/StoreContext";
import { formatCurrency } from "../utils/format";

function ProductDetails() {
  const { productId } = useParams();
  const { products, addToCart } = useStore();
  const product = products.find((item) => item.id === productId);
  const [activeImage, setActiveImage] = useState(product?.images?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setActiveImage(product?.images?.[0] ?? "");
    setQuantity(1);
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);
  }, [product, products]);

  if (!product) {
    return <Navigate to="/products" replace />;
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel rounded-[2.5rem] p-5">
          <img src={activeImage} alt={product.name} className="h-[420px] w-full rounded-[2rem] object-cover sm:h-[520px]" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {product.images.map((image) => (
              <button key={image} type="button" onClick={() => setActiveImage(image)} className={`overflow-hidden rounded-[1.25rem] border p-1 transition ${activeImage === image ? "border-[var(--color-primary)]" : "border-transparent hover:border-[var(--color-border)]"}`}>
                <img src={image} alt={product.name} className="h-28 w-full rounded-[1rem] object-cover" />
              </button>
            ))}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[2.5rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-[var(--color-primary)]/12 px-3 py-1 font-semibold text-[var(--color-primary)]">{product.badge}</span>
            <span className="text-[var(--color-text-soft)]">{product.category}</span>
            <span className="text-[var(--color-text-soft)]">{product.rating} rating ({product.reviewsCount} reviews)</span>
          </div>

          <h1 className="section-title mt-5 text-4xl">{product.name}</h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-soft)]">{product.description}</p>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)]">Price</p>
              <p className="text-4xl font-bold">{formatCurrency(product.price)}</p>
            </div>
            <p className="rounded-full bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-600">{product.stock} units available</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {product.colors.map((color) => (
              <span key={color} className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm">{color}</span>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <div className="flex items-center rounded-full border border-[var(--color-border)] bg-white/70 px-3 py-2">
              <button type="button" onClick={() => setQuantity((count) => Math.max(1, count - 1))} className="h-10 w-10 rounded-full text-xl" aria-label="Decrease quantity">-</button>
              <span className="min-w-10 text-center font-semibold">{quantity}</span>
              <button type="button" onClick={() => setQuantity((count) => Math.min(product.stock, count + 1))} className="h-10 w-10 rounded-full text-xl" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" onClick={() => addToCart(product, quantity)} className="rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--color-secondary)]">
              Add {quantity} to cart
            </button>
            <Link to="/checkout" className="rounded-full border border-[var(--color-border)] px-6 py-4 text-center text-sm font-semibold transition hover:bg-white/60">
              Buy now
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {product.specs.map((spec) => (
              <div key={spec} className="rounded-[1.5rem] border border-[var(--color-border)] bg-white/70 px-4 py-4 text-sm">{spec}</div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Reviews</p>
          <div className="mt-6 space-y-5">
            {[
              {
                name: "Jordan W.",
                text: "The fit and finish feel exceptional. It looks premium in person and the interaction design of the site made checkout effortless.",
              },
              {
                name: "Nadia S.",
                text: "Thoughtful product details, fast browsing, and a very clean mobile layout. This feels closer to a polished app than a typical store.",
              },
            ].map((review) => (
              <article key={review.name} className="rounded-[1.5rem] border border-[var(--color-border)] bg-white/70 p-5">
                <p className="font-semibold">{review.name}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">{review.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Shipping & care</p>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-[var(--color-text-soft)]">
            <li>Free shipping on orders above ?500.</li>
            <li>30-day return window on unopened accessories and devices.</li>
            <li>Dedicated support for setup guidance and delivery tracking.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Related products</p>
          <h2 className="section-title mt-2 text-3xl">Keep the visual language consistent</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {relatedProducts.map((relatedProduct) => (
            <ProductCard key={relatedProduct.id} product={relatedProduct} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default ProductDetails;
