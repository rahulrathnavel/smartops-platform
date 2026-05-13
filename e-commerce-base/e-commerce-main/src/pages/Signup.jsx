import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await signup({ email, password, name });
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
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">Get started</p>
        <h1 className="section-title mt-2 text-4xl">Create your account</h1>
        <p className="mt-3 text-sm text-[var(--color-text-soft)]">
          Join ammazone and get a $1,000 virtual balance to start shopping immediately.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="signup-name" className="text-sm font-semibold">Full name</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="text-sm font-semibold">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="text-sm font-semibold">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white/75 px-4 py-3 outline-none"
              placeholder="At least 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--color-secondary)] disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-soft)]">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[var(--color-primary)]">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Signup;
