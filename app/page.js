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
        <h1 className="mb-2 text-center text-4xl font-semibold tracking-tight text-black">Travelport</h1>
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-black/60">Powered by Adyen</p>
        <div className="rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.12)]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

