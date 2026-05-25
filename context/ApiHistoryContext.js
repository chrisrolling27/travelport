"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { endpointFromProxy, extractDetail, resolveEndpointPlaceholders } from "@/lib/utils";

const ApiHistoryContext = createContext(null);

// Proxy routes that don't represent an Adyen API call (e.g. local config reads).
// Requests to these paths are passed through without being recorded in API history.
const NON_ADYEN_PROXY_PATHS = new Set(["/api/adyen/checkout/client-key"]);

function isAdyenProxyCall(url) {
  if (!url) return false;
  const path = url.split("?")[0];
  if (NON_ADYEN_PROXY_PATHS.has(path)) return false;
  return path === "/api/login" || path.startsWith("/api/adyen/");
}

export function ApiHistoryProvider({ children }) {
  const [entries, setEntries] = useState([]);

  const clear = useCallback(() => setEntries([]), []);

  const trackedFetch = useCallback(async (url, options = {}) => {
    const actualMethod = options.method || "GET";
    const timestamp = new Date().toISOString();
    const rawRequestBody = options.body ? JSON.parse(options.body) : null;
    // Login is a POST to our proxy but is presented as a GET on the underlying account holder lookup.
    const isLoginCall = url === "/api/login";
    const method = isLoginCall ? "GET" : actualMethod;
    // Never persist the login request body — it contains anti-bot fields
    // (honeypot, formStartedAt) that must not be exposed in API history.
    const requestBody = isLoginCall ? null : rawRequestBody;
    const shouldRecord = isAdyenProxyCall(url);
    const endpoint = shouldRecord ? endpointFromProxy(url, method, requestBody) : "";

    try {
      const response = await fetch(url, options);
      const payload = await response.json().catch(() => ({}));

      if (!shouldRecord) {
        if (!response.ok) {
          const err = new Error(payload?.error || payload?.message || "Request failed");
          err.status = response.status;
          err.payload = payload;
          throw err;
        }
        return payload;
      }

      // For the login call, replace the placeholder with the actual AH id from the response.
      // For other calls, resolve any remaining `{xxxId}` placeholders using the response body.
      const resolvedEndpoint =
        isLoginCall && payload?.accountHolderId
          ? `/bcl/v2/accountHolders/${payload.accountHolderId}`
          : resolveEndpointPlaceholders(endpoint, payload, requestBody);
      const detail = extractDetail(resolvedEndpoint, payload);

      const newEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp,
        method,
        endpoint: resolvedEndpoint,
        requestBody,
        responseBody: payload,
        status: response.status,
        detail,
      };

      // When a brand-new account holder was provisioned during login, the server
      // returns the LE/AH/BA POST calls it made so we can surface them here.
      const provisionEntries =
        isLoginCall && Array.isArray(payload?.provisionCalls)
          ? payload.provisionCalls.map((call, index) => ({
              id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`,
              timestamp,
              method: call.method || "POST",
              endpoint: call.endpoint || "",
              requestBody: call.requestBody || null,
              responseBody: call.responseBody || null,
              status: call.status || 200,
              detail: extractDetail(call.endpoint || "", call.responseBody || {}),
            }))
          : [];

      // Login is the start of a session — discard any prior entries so history
      // only shows calls made on behalf of the current account holder.
      setEntries((prev) =>
        url === "/api/login"
          ? [newEntry, ...provisionEntries]
          : [newEntry, ...prev]
      );

      if (!response.ok) {
        const err = new Error(payload?.error || payload?.message || "Request failed");
        err.status = response.status;
        err.payload = payload;
        throw err;
      }

      return payload;
    } catch (error) {
      if (shouldRecord) {
        const errorEntry = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp,
          method,
          endpoint,
          requestBody,
          responseBody: error.payload || { error: error.message },
          status: error.status || 500,
          detail: extractDetail(endpoint, error.payload || { error: error.message }),
        };
        setEntries((prev) => (url === "/api/login" ? [errorEntry] : [errorEntry, ...prev]));
      }
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({ entries, trackedFetch, clear }),
    [clear, entries, trackedFetch]
  );

  return <ApiHistoryContext.Provider value={value}>{children}</ApiHistoryContext.Provider>;
}

export function useApiHistory() {
  const context = useContext(ApiHistoryContext);
  if (!context) throw new Error("useApiHistory must be used inside ApiHistoryProvider");
  return context;
}

