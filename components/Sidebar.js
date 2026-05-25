"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const panel = (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-black text-white">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center">
          <p className="text-3xl font-extrabold tracking-tight text-white">Travelport</p>
          <span
            aria-hidden="true"
            className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
          >
            <Image
              src="/travelport-mark.svg"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </span>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`block rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-white bg-white/10 text-white"
                    : "border-transparent text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-xs text-white/70">{user?.email || user?.companyName || "—"}</p>
        <button
          type="button"
          onClick={() => {
            if (onMobileClose) onMobileClose();
            logout();
            router.push("/");
          }}
          className="mt-2 w-full rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="sticky top-0 hidden h-screen lg:block">{panel}</div>

      {/* Mobile: slide-in drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={onMobileClose}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 h-full transform transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {panel}
        </div>
      </div>
    </>
  );
}
