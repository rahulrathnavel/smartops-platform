import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-md rounded-[2.5rem] p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Welcome back</p>
        <h1 className="section-title mt-2 text-4xl">Sign in to ammazone</h1>
        <p className="mt-3 text-sm text-[var(--color-text-soft)]">
          Enter your credentials to access your account and continue shopping.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="text-sm font-semibold">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-semibold">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--color-secondary)] disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-soft)]">
          New to ammazone?{" "}
          <Link to="/signup" className="font-semibold text-[var(--color-primary)]">Create an account</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
