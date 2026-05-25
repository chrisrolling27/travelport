"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ApiHistoryProvider } from "@/context/ApiHistoryContext";

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ApiHistoryProvider>{children}</ApiHistoryProvider>
    </AuthProvider>
  );
}

