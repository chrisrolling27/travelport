"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdyenComponentMount from "@/components/AdyenComponentMount";
import BalanceAccountCard from "@/components/BalanceAccountCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import MainAccountTransfer from "@/components/MainAccountTransfer";
import PageHeader from "@/components/PageHeader";
import Toast, { useToast } from "@/components/Toast";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";

const OVERVIEW_REFRESH_MS = 10000;

export default function HomePage() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const [overview, setOverview] = useState(null);
  const [cardsIssued, setCardsIssued] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast, clearToast, showSuccess, showError } = useToast();
  const [error, setError] = useState("");
  const hasLoadedOnceRef = useRef(false);

  const loadOverview = useCallback(async () => {
    try {
      const balanceAccountId = user.balanceAccountId;
      const encoded = encodeURIComponent(balanceAccountId);
      const [data, cardsPayload] = await Promise.all([
        trackedFetch(`/api/adyen/account-overview?balanceAccountId=${encoded}`),
        trackedFetch(`/api/adyen/cards?balanceAccountId=${encoded}`).catch(() => null),
      ]);
      setOverview(data);
      if (Array.isArray(cardsPayload?.paymentInstruments)) {
        setCardsIssued(cardsPayload.paymentInstruments.length);
      }
      setError("");
      hasLoadedOnceRef.current = true;
    } catch (err) {
      setError(err.message);
      showError(err.message || "Failed to load account overview.");
    } finally {
      setLoading(false);
    }
  }, [showError, trackedFetch, user.balanceAccountId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!user.balanceAccountId) return undefined;

    const interval = setInterval(() => {
      loadOverview();
    }, OVERVIEW_REFRESH_MS);

    const refreshOnForeground = () => {
      if (document.visibilityState === "visible") loadOverview();
    };

    window.addEventListener("focus", refreshOnForeground);
    document.addEventListener("visibilitychange", refreshOnForeground);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshOnForeground);
      document.removeEventListener("visibilitychange", refreshOnForeground);
    };
  }, [loadOverview, user.balanceAccountId]);

  const balances = useMemo(() => {
    const items = overview?.balances || [];
    const usd =
      items.find((item) => (item?.currency || item?.available?.currency || item?.balance?.currency) === "USD") ||
      items[0];

    // Adyen may return scalar minor units or nested objects ({ value, currency }).
    const balanceRaw = usd?.balance;
    const availableRaw = usd?.available;
    const balanceValue =
      typeof balanceRaw === "number" ? balanceRaw : Number(balanceRaw?.value ?? 0);
    const availableValue =
      typeof availableRaw === "number" ? availableRaw : Number(availableRaw?.value ?? 0);
    const pendingValue =
      typeof usd?.pending === "number" ? usd.pending : Number(usd?.pending?.value || usd?.reserved?.value || 0);
    const currencyCode =
      usd?.currency || usd?.available?.currency || usd?.balance?.currency || "USD";

    return {
      balance: Number.isFinite(balanceValue) ? balanceValue : 0,
      available: Number.isFinite(availableValue) ? availableValue : 0,
      pending: Number.isFinite(pendingValue) ? pendingValue : 0,
      currency: currencyCode,
    };
  }, [overview]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Account" subtitle="View account details and transfer funds" />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-stretch">
        <div className="h-full min-h-0 w-full">
          {loading && !hasLoadedOnceRef.current ? (
            <div className="space-y-3">
              <LoadingSkeleton className="h-8 w-64" />
              <LoadingSkeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
            </div>
          ) : (
            <BalanceAccountCard
              balanceMinorUnits={balances.balance}
              availableMinorUnits={balances.available}
              pendingMinorUnits={balances.pending}
              currency={balances.currency}
              cardsIssued={cardsIssued}
              balanceAccountId={user.balanceAccountId}
              accountHolderId={user.accountHolderId}
              transferInstrumentId={
                user?.transferInstrumentId ||
                user?.capabilities?.sendToTransferInstrument?.transferInstruments?.find(
                  (ti) => ti?.id && ti?.allowed !== false
                )?.id ||
                user?.capabilities?.receiveFromTransferInstrument?.transferInstruments?.find(
                  (ti) => ti?.id && ti?.allowed !== false
                )?.id ||
                ""
              }
            />
          )}
        </div>

        <div className="ca-panel-tight">
          <MainAccountTransfer onTransferComplete={loadOverview} onSuccess={showSuccess} onError={showError} />
        </div>
      </section>

      <section>
        <AdyenComponentMount
          componentName="TransactionsOverview"
          accountHolderId={user.accountHolderId}
          roles={["Transactions Overview Component: View"]}
        />
      </section>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}

