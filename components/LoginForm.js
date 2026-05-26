"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";

const EMAIL_LOGIN_PROGRESS = [
  "Loading account holders…",
  "Checking references…",
  "Matching your email…",
  "Almost there…",
];

export default function LoginForm() {
  const router = useRouter();
  const { trackedFetch } = useApiHistory();
  const { setSession } = useAuth();
  const [loadingMode, setLoadingMode] = useState("");
  const [emailLoginProgressIdx, setEmailLoginProgressIdx] = useState(0);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  // AccountHolder id pre-resolved from the email as the user types. When set,
  // /api/login skips the slow find-by-reference step and goes straight to hydrate.
  const resolvedAccountHolderIdRef = useRef("");
  const resolveAbortRef = useRef(null);
  // Once resolve identifies a real AccountHolder, we kick off the actual
  // hydrate-and-return-session call in the background and stash the promise.
  // On submit we just await the already-running call.
  const preloginPromiseRef = useRef(null);
  const preloginEmailRef = useRef("");
  const preloginAbortRef = useRef(null);

  // Debounced background resolve: each keystroke schedules a /api/login/resolve
  // call ~300ms later. By the time the user clicks Login, we usually already
  // have their AccountHolder id in hand and the server can skip the lookup.
  useEffect(() => {
    resolvedAccountHolderIdRef.current = "";
    // Invalidate any prior prelogin if the email changed.
    if (preloginEmailRef.current && preloginEmailRef.current !== email.trim().toLowerCase()) {
      if (preloginAbortRef.current) preloginAbortRef.current.abort();
      preloginPromiseRef.current = null;
      preloginEmailRef.current = "";
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 5) return undefined;

    if (resolveAbortRef.current) resolveAbortRef.current.abort();
    const controller = new AbortController();
    resolveAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/login/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (email.trim().toLowerCase() !== trimmed) return;

        const accountHolderId = data?.accountHolderId || "";
        resolvedAccountHolderIdRef.current = accountHolderId;

        // Known existing user → start the real login in the background so by the
        // time they hit the button, hydrate has already completed (or is close to).
        if (accountHolderId && preloginEmailRef.current !== trimmed) {
          if (preloginAbortRef.current) preloginAbortRef.current.abort();
          const preloginController = new AbortController();
          preloginAbortRef.current = preloginController;
          preloginEmailRef.current = trimmed;
          preloginPromiseRef.current = fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed, accountHolderId }),
            signal: preloginController.signal,
          })
            .then(async (response) => {
              if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || "prelogin failed");
              return response.json();
            })
            .catch((_error) => null);
        }
      } catch (_error) {
        // Aborted or network error — ignore; submit path will fall back.
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email]);

  useEffect(() => {
    if (loadingMode !== "email") {
      setEmailLoginProgressIdx(0);
      return undefined;
    }
    setEmailLoginProgressIdx(0);
    const id = setInterval(() => {
      setEmailLoginProgressIdx((i) => (i + 1) % EMAIL_LOGIN_PROGRESS.length);
    }, 850);
    return () => clearInterval(id);
  }, [loadingMode]);

  const onLoginWithEmail = async (event) => {
    event.preventDefault();
    if (loadingMode) return;
    setError("");
    setLoadingMode("email");
    try {
      const trimmed = email.trim().toLowerCase();
      // If we already started a prelogin for this exact email, just await its result.
      if (preloginPromiseRef.current && preloginEmailRef.current === trimmed) {
        const preloadedSession = await preloginPromiseRef.current;
        if (preloadedSession?.accountHolderId) {
          setSession(preloadedSession);
          router.push("/account");
          return;
        }
        // Prelogin failed — fall through to a normal submit below.
        preloginPromiseRef.current = null;
        preloginEmailRef.current = "";
      }
      const data = await trackedFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          honeypot,
          formStartedAt,
          accountHolderId: resolvedAccountHolderIdRef.current || undefined,
        }),
      });
      setSession(data);
      router.push("/account");
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setLoadingMode("");
    }
  };

  return (
    <div className="ca-surface w-full max-w-md p-7">
      <form className="space-y-4" onSubmit={onLoginWithEmail}>
        {loadingMode === "email" && (
          <div
            className="flex items-center gap-3 rounded-lg border border-[#E4E9F2] bg-white px-3 py-3 text-sm text-[#4B5A72]"
            role="status"
            aria-live="polite"
          >
            <span
              className="inline-block size-5 shrink-0 rounded-full border-2 border-[#D8DFEA] border-t-[#2575FC] animate-spin"
              aria-hidden
            />
            <span className="min-w-0">{EMAIL_LOGIN_PROGRESS[emailLoginProgressIdx]}</span>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-2">
          <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wide text-[#5C6B84]">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="ca-input w-full"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          className="hidden"
          aria-hidden="true"
        />

        <button
          type="submit"
          disabled={Boolean(loadingMode)}
          className="ca-button w-full"
        >
          {loadingMode === "email" ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

