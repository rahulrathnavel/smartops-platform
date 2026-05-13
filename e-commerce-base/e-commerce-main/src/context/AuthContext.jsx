import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("ammazone-token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.profile()
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem("ammazone-token");
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const signup = async ({ email, password, name }) => {
    const data = await authApi.signup({ email, password, name });
    localStorage.setItem("ammazone-token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const login = async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem("ammazone-token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("ammazone-token");
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const data = await authApi.profile();
      setUser(data.user);
    } catch {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout, refreshProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
