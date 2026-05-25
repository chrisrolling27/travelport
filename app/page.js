"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import SmokeBackground from "@/components/SmokeBackground";
import { useAuth } from "@/context/AuthContext";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function LandingPage() {
  const router = useRouter();
  const { user, restoring } = useAuth();

  useEffect(() => {
    if (user) router.replace("/account");
  }, [router, user]);

  if (restoring) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <LoadingSkeleton className="h-72 w-full max-w-md" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <SmokeBackground />

      <div className="relative z-10 w-full max-w-md">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-[#0ABF53]">Adyen</p>
        <h1 className="mb-2 text-center text-4xl font-semibold tracking-tight text-[#0B1222]">CardPortal</h1>
        <div className="rounded-2xl shadow-[0_4px_30px_rgba(10,191,83,0.12)]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

