import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  experienceLevel: string;
}

interface AuthContextType {
  customer: Customer | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  setAuthenticatedCustomer: (customer: Customer, token?: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("mr_customer");
    if (stored) {
      try {
        setCustomer(JSON.parse(stored));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    setCustomer(data.customer);
    localStorage.setItem("mr_customer", JSON.stringify(data.customer));
    if (typeof data.token === "string") {
      localStorage.setItem("mr_customer_token", data.token);
    }
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const data = await res.json();
    setCustomer(data.customer);
    localStorage.setItem("mr_customer", JSON.stringify(data.customer));
    if (typeof data.token === "string") {
      localStorage.setItem("mr_customer_token", data.token);
    }
  };

  const setAuthenticatedCustomer = (nextCustomer: Customer, token?: string) => {
    setCustomer(nextCustomer);
    localStorage.setItem("mr_customer", JSON.stringify(nextCustomer));
    if (typeof token === "string" && token) {
      localStorage.setItem("mr_customer_token", token);
    }
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem("mr_customer");
    localStorage.removeItem("mr_customer_token");
  };

  return (
    <AuthContext.Provider value={{ customer, login, register, setAuthenticatedCustomer, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
