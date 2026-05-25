"use client";

import { useEffect, useState } from "react";
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
      const data = await trackedFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          honeypot,
          formStartedAt,
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

