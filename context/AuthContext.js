"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "cardportal_auth_v1";

// In dev, skip localStorage so each full reload starts at the login screen (no "remember me").
const PERSIST_AUTH = process.env.NODE_ENV === "production";

function normalizeSession(data) {
  return {
    accountHolderId: data?.accountHolderId || "",
    balanceAccountId: data?.balanceAccountId || "",
    legalEntityId: data?.legalEntityId || "",
    transferInstrumentId: data?.transferInstrumentId || "",
    email: data?.email || "",
    companyName: data?.companyName || "Business",
    capabilities: data?.capabilities || {},
    accountHolderStatus: data?.accountHolderStatus || "",
    balanceAccounts: data?.balanceAccounts || [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setSession = useCallback((nextUser) => {
    const session = normalizeSession(nextUser);
    setUser(session);
    if (PERSIST_AUTH) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, []);

  useEffect(() => {
    const restore = async () => {
      if (!PERSIST_AUTH) {
        setRestoring(false);
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountHolderId: parsed?.accountHolderId || "",
          }),
        });
        if (!res.ok) throw new Error("Unable to validate existing session.");
        const data = await res.json();
        setUser(normalizeSession(data));
      } catch (_error) {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setRestoring(false);
      }
    };
    restore();
  }, []);

  const value = useMemo(
    () => ({ user, restoring, setSession, logout }),
    [logout, restoring, setSession, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

