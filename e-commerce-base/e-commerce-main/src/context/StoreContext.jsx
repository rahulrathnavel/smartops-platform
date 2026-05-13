import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { products as fallbackProducts } from "../data/products";

const StoreContext = createContext(null);
const API = "/api";

const getInitialCart = () => {
  const storedCart = localStorage.getItem("ammazone-cart");
  return storedCart ? JSON.parse(storedCart) : [];
};

const getToken = () => localStorage.getItem("ammazone-token");

// Send analytics/tracking event to backend
const trackEvent = async (event, data = {}) => {
  try {
    await fetch(`${API}/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...data, ts: new Date().toISOString() }),
    });
  } catch {
    // non-blocking
  }
};

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(fallbackProducts);
  const [cart, setCart] = useState(getInitialCart);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("ammazone-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Fetch products from catalog-service on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API}/products`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            // Map backend fields to frontend fields
            const mapped = data.map((p, i) => ({
              id: p.productId || p._id || i + 1,
              ...p,
            }));
            setProducts(mapped);
          }
        }
      } catch {
        // fallback to local products
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
    trackEvent("page_view", { page: "app_init" });
  }, []);

  // Persist cart to localStorage + sync to backend
  useEffect(() => {
    localStorage.setItem("ammazone-cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((product, quantity = 1) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);
      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item,
        );
      }
      return [...currentCart, { ...product, quantity }];
    });

    // Track add-to-cart through API (generates backend logs)
    trackEvent("add_to_cart", {
      productId: product.productId || product.id,
      productName: product.name,
      price: product.price,
      quantity,
    });

    // Also hit the cart service to generate real backend traffic
    const token = getToken();
    fetch(`${API}/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        productId: product.productId || product.id,
        name: product.name,
        price: product.price,
        quantity,
      }),
    }).catch(() => {});
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    trackEvent("update_cart", { productId, quantity });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
    trackEvent("remove_from_cart", { productId });

    const token = getToken();
    fetch(`${API}/cart/${productId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    trackEvent("clear_cart");
  }, []);

  // Auth functions that hit the real user-service
  const signup = useCallback(async (name, email, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed");
    localStorage.setItem("ammazone-token", data.token);
    localStorage.setItem("ammazone-user", JSON.stringify(data.user));
    setUser(data.user);
    trackEvent("user_signup", { email });
    return data;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("ammazone-token", data.token);
    localStorage.setItem("ammazone-user", JSON.stringify(data.user));
    setUser(data.user);
    trackEvent("user_login", { email });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ammazone-token");
    localStorage.removeItem("ammazone-user");
    setUser(null);
    trackEvent("user_logout");
  }, []);

  // Place order through the real order-service
  const placeOrder = useCallback(async (orderData) => {
    const token = getToken();
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        items: cart.map((item) => ({
          productId: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        ...orderData,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Order failed");
    trackEvent("order_placed", { orderId: data.orderId, total: data.total });
    clearCart();
    return data;
  }, [cart, clearCart]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? (subtotal >= 500 ? 0 : 24) : 0;
  const taxes = subtotal * 0.08;
  const total = subtotal + shipping + taxes;

  const featuredProducts = useMemo(() => products.filter((product) => product.featured), [products]);

  const value = useMemo(
    () => ({
      products,
      featuredProducts,
      cart,
      cartCount,
      subtotal,
      shipping,
      taxes,
      total,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      user,
      signup,
      login,
      logout,
      placeOrder,
      loading,
    }),
    [cart, cartCount, featuredProducts, products, shipping, subtotal, taxes, total, user, loading,
      addToCart, updateQuantity, removeFromCart, clearCart, signup, login, logout, placeOrder],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
