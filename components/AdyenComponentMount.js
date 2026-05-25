"use client";

import { useEffect, useRef, useState } from "react";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function AdyenComponentMount({
  componentName,
  accountHolderId,
  balanceAccountId,
  roles,
  fallback,
  className = "ca-panel-tight",
}) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rolesKey = JSON.stringify(roles || []);
  const sessionCacheRef = useRef({
    key: "",
    value: null,
    expiresAt: 0,
    inFlight: null,
  });

  useEffect(() => {
    let mounted = true;
    let componentInstance = null;

    const init = async () => {
      setLoading(true);
      setError("");

      if (!accountHolderId) {
        setError("Missing account holder ID for component session.");
        setLoading(false);
        return;
      }

      try {
        const parsedRoles = JSON.parse(rolesKey);
        const sdk = await import("@adyen/adyen-platform-experience-web");
        await import("@adyen/adyen-platform-experience-web/adyen-platform-experience-web.css");

        const map = {
          TransactionsOverview: sdk.TransactionsOverview,
          PayoutsOverview: sdk.PayoutsOverview,
          ReportsOverview: sdk.ReportsOverview,
        };
        const Component = map[componentName];
        if (!Component) throw new Error(`Unknown component: ${componentName}`);

        const sessionKey = `${accountHolderId}:${balanceAccountId || ""}:${rolesKey}`;
        const getSession = async () => {
          const now = Date.now();
          const cached = sessionCacheRef.current;

          // Reuse an already fetched session for a short period.
          if (cached.key === sessionKey && cached.value && cached.expiresAt > now) {
            return cached.value;
          }

          // Deduplicate concurrent session creation calls.
          if (cached.key === sessionKey && cached.inFlight) {
            return cached.inFlight;
          }

          const requestPromise = fetch("/api/adyen/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountHolderId, roles: parsedRoles }),
          }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              const err = new Error(payload?.error || payload?.message || "Session creation failed.");
              err.status = response.status;
              err.payload = payload;
              throw err;
            }

            const expiresAtMs = payload?.expiresAt ? new Date(payload.expiresAt).getTime() : 0;
            const fallbackExpiresAt = Date.now() + 60 * 1000;
            sessionCacheRef.current = {
              key: sessionKey,
              value: payload,
              expiresAt: Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() ? expiresAtMs : fallbackExpiresAt,
              inFlight: null,
            };
            return payload;
          });

          sessionCacheRef.current = {
            ...cached,
            key: sessionKey,
            inFlight: requestPromise,
          };

          return requestPromise;
        };

        const core = await sdk.AdyenPlatformExperience({ onSessionCreate: getSession });
        const componentProps =
          componentName === "ReportsOverview" && balanceAccountId
            ? { core, balanceAccountId }
            : { core };
        componentInstance = new Component(componentProps);

        if (mounted && containerRef.current) {
          componentInstance.mount(containerRef.current);
          setLoading(false);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Component failed to load.");
        setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
      componentInstance?.unmount?.();
    };
  }, [accountHolderId, balanceAccountId, componentName, rolesKey]);

  if (error) return fallback || <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <div className="relative">
      <div className={className} ref={containerRef} />
      {loading ? (
        <div className="pointer-events-none absolute inset-0">
          <LoadingSkeleton className="h-64 w-full" />
        </div>
      ) : null}
    </div>
  );
}

