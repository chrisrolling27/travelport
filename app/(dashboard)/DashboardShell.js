"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, restoring, setSession } = useAuth();
  const [rehydrating, setRehydrating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const rehydrateAttempted = useRef(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (restoring || user) return;

    const accountHolderId = searchParams?.get("accountHolderId") || "";
    if (accountHolderId && !rehydrateAttempted.current) {
      rehydrateAttempted.current = true;
      setRehydrating(true);
      (async () => {
        try {
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountHolderId }),
          });
          if (!res.ok) throw new Error("Rehydrate failed");
          const data = await res.json();
          setSession(data);
          const params = new URLSearchParams(searchParams.toString());
          params.delete("accountHolderId");
          const qs = params.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        } catch {
          router.replace("/");
        } finally {
          setRehydrating(false);
        }
      })();
      return;
    }

    if (!accountHolderId) router.replace("/");
  }, [pathname, restoring, router, searchParams, setSession, user]);

  if (restoring || rehydrating || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <LoadingSkeleton className="h-72 w-full max-w-3xl" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#DCE3EF] bg-[#0A1633] px-4 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"
          >
            <Menu size={22} />
          </button>
          <p className="text-lg font-extrabold tracking-tight">CardPortal</p>
        </header>
        <main className="flex-1 bg-[#F4F6FA] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
