"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import CardWalletViewer from "@/components/CardWalletViewer";
import PageHeader from "@/components/PageHeader";
import Toast, { useToast } from "@/components/Toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/utils";

const AIRPORTS = [
  { city: "New York", code: "JFK" },
  { city: "Los Angeles", code: "LAX" },
  { city: "London", code: "LHR" },
  { city: "Paris", code: "CDG" },
  { city: "Tokyo", code: "HND" },
  { city: "Hong Kong", code: "HKG" },
  { city: "Singapore", code: "SIN" },
  { city: "Dubai", code: "DXB" },
  { city: "Sydney", code: "SYD" },
  { city: "Mumbai", code: "BOM" },
  { city: "Shanghai", code: "PVG" },
  { city: "Beijing", code: "PEK" },
  { city: "Seoul", code: "ICN" },
  { city: "Bangkok", code: "BKK" },
  { city: "Istanbul", code: "IST" },
  { city: "Rome", code: "FCO" },
  { city: "Madrid", code: "MAD" },
  { city: "Barcelona", code: "BCN" },
  { city: "Berlin", code: "BER" },
  { city: "Amsterdam", code: "AMS" },
  { city: "Zurich", code: "ZRH" },
  { city: "Vienna", code: "VIE" },
  { city: "Cairo", code: "CAI" },
  { city: "Cape Town", code: "CPT" },
  { city: "Johannesburg", code: "JNB" },
  { city: "Lagos", code: "LOS" },
  { city: "Nairobi", code: "NBO" },
  { city: "Rio de Janeiro", code: "GIG" },
  { city: "São Paulo", code: "GRU" },
  { city: "Buenos Aires", code: "EZE" },
  { city: "Mexico City", code: "MEX" },
  { city: "Toronto", code: "YYZ" },
  { city: "Vancouver", code: "YVR" },
  { city: "Chicago", code: "ORD" },
  { city: "San Francisco", code: "SFO" },
  { city: "Miami", code: "MIA" },
  { city: "Boston", code: "BOS" },
  { city: "Seattle", code: "SEA" },
  { city: "Lisbon", code: "LIS" },
  { city: "Athens", code: "ATH" },
  { city: "Prague", code: "PRG" },
  { city: "Stockholm", code: "ARN" },
  { city: "Copenhagen", code: "CPH" },
  { city: "Oslo", code: "OSL" },
  { city: "Helsinki", code: "HEL" },
  { city: "Dublin", code: "DUB" },
  { city: "Reykjavik", code: "KEF" },
  { city: "Doha", code: "DOH" },
  { city: "Riyadh", code: "RUH" },
  { city: "Tel Aviv", code: "TLV" },
  { city: "Jakarta", code: "CGK" },
  { city: "Kuala Lumpur", code: "KUL" },
  { city: "Manila", code: "MNL" },
  { city: "Ho Chi Minh City", code: "SGN" },
  { city: "Taipei", code: "TPE" },
  { city: "Auckland", code: "AKL" },
  { city: "Lima", code: "LIM" },
  { city: "Bogotá", code: "BOG" },
  { city: "Santiago", code: "SCL" },
  { city: "Havana", code: "HAV" },
];

const AIRLINES = [
  { name: "American Airlines", code: "AA" },
  { name: "Delta Air Lines", code: "DL" },
  { name: "United Airlines", code: "UA" },
  { name: "Southwest Airlines", code: "WN" },
  { name: "Emirates", code: "EK" },
  { name: "Lufthansa", code: "LH" },
  { name: "Qatar Airways", code: "QR" },
];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pad(n, width) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

function createRandomFlight() {
  const origin = randomChoice(AIRPORTS);
  const destination = randomChoice(AIRPORTS.filter((a) => a.code !== origin.code));
  const airline = randomChoice(AIRLINES);
  const flightNumber = Math.floor(Math.random() * 9000) + 100; // 100-9099
  const flightCode = `${airline.code}${pad(flightNumber, 4)}`; // e.g. AA0517
  const flightDisplay = `${airline.code} ${flightNumber}`; // e.g. AA 517
  return {
    airlineName: airline.name,
    airlineCode: airline.code,
    flightNumber,
    flightCode,
    flightDisplay,
    origin,
    destination,
    amountMinor: Math.floor(Math.random() * 24900) + 25000,
    currency: "USD",
    reference: flightCode,
  };
}

export default function CheckoutPage() {
  const { trackedFetch } = useApiHistory();
  const { user, refreshSession } = useAuth();
  const { toast, clearToast, showSuccess, showError } = useToast();
  const [order, setOrder] = useState(() => createRandomFlight());
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");
  const [revealByCardId, setRevealByCardId] = useState({});
  const [revealLoadingByCardId, setRevealLoadingByCardId] = useState({});
  const [revealErrorByCardId, setRevealErrorByCardId] = useState({});

  const orderAmount = useMemo(
    () => formatCurrency(order.amountMinor, order.currency),
    [order.amountMinor, order.currency]
  );

  const loadCards = useCallback(async () => {
    if (!user?.balanceAccountId) {
      setCards([]);
      setCardsError("");
      setCardsLoading(false);
      return;
    }
    setCardsLoading(true);
    setCardsError("");
    try {
      const data = await trackedFetch(`/api/adyen/cards?balanceAccountId=${user.balanceAccountId}`);
      const list = data.paymentInstruments || [];
      setCards(list);
      const idSet = new Set(list.map((item) => item?.id).filter(Boolean));
      setRevealByCardId((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([cardId]) => idSet.has(cardId)))
      );
      setRevealLoadingByCardId((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([cardId]) => idSet.has(cardId)))
      );
      setRevealErrorByCardId((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([cardId]) => idSet.has(cardId)))
      );
    } catch (error) {
      setCards([]);
      setCardsError(getApiErrorMessage(error));
    } finally {
      setCardsLoading(false);
    }
  }, [trackedFetch, user?.balanceAccountId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Store id is no longer included in the login hydrate payload (moved off the
  // critical path for login speed), so fetch it here for use by /sessions and
  // /payments. Cached for the session lifetime.
  const [storeId, setStoreId] = useState("");
  useEffect(() => {
    const legalEntityId = user?.legalEntityId;
    if (!legalEntityId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await trackedFetch(
          `/api/adyen/onboarding-context?legalEntityId=${encodeURIComponent(legalEntityId)}`
        );
        if (!cancelled) setStoreId(data?.storeId || "");
      } catch (_error) {
        // Best-effort; payment calls will show a clearer error if storeId is needed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.legalEntityId, trackedFetch]);

  const revealCardDetails = useCallback(
    async (paymentInstrumentId) => {
      if (!paymentInstrumentId) return null;
      if (revealByCardId[paymentInstrumentId]) {
        setRevealErrorByCardId((prev) => ({ ...prev, [paymentInstrumentId]: "" }));
        return revealByCardId[paymentInstrumentId];
      }
      setRevealLoadingByCardId((prev) => ({ ...prev, [paymentInstrumentId]: true }));
      setRevealErrorByCardId((prev) => ({ ...prev, [paymentInstrumentId]: "" }));
      try {
        const payload = await trackedFetch("/api/adyen/cards/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentInstrumentId }),
        });
        setRevealByCardId((prev) => ({ ...prev, [paymentInstrumentId]: payload }));
        return payload;
      } catch (error) {
        const message = getApiErrorMessage(error);
        setRevealErrorByCardId((prev) => ({ ...prev, [paymentInstrumentId]: message }));
        return null;
      } finally {
        setRevealLoadingByCardId((prev) => ({ ...prev, [paymentInstrumentId]: false }));
      }
    },
    [revealByCardId, trackedFetch]
  );

  const [acquiredFlight, setAcquiredFlight] = useState(null);

  const randomizeOrder = () => {
    setOrder(createRandomFlight());
    setAcquiredFlight(null);
  };

  const [acquiring, setAcquiring] = useState(false);
  const acquireFlight = async () => {
    if (!storeId) {
      showError("No store configured for this account. Complete onboarding first.");
      return;
    }
    if (!user?.balanceAccountId) {
      showError("No balance account on file.");
      return;
    }
    setAcquiring(true);
    try {
      const payload = await trackedFetch("/api/adyen/checkout/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.amountMinor,
          currency: order.currency,
          reference: order.reference,
          storeId,
          balanceAccountId: user.balanceAccountId,
        }),
      });
      const resultCode = payload?.resultCode || "Unknown";
      if (resultCode === "Authorised") {
        setAcquiredFlight({
          ...order,
          pspReference: payload?.pspReference || "",
          acquiredAt: new Date().toISOString(),
        });
        showSuccess(
          `Flight acquired\n${order.airlineName} ${order.flightDisplay} · ${order.origin.code} → ${order.destination.code}\n${orderAmount}`
        );
      } else {
        showError(`Payment ${resultCode}${payload?.refusalReason ? `: ${payload.refusalReason}` : ""}`);
      }
    } catch (error) {
      showError(`Payment failed: ${getApiErrorMessage(error)}`);
    } finally {
      setAcquiring(false);
    }
  };

  const dropinContainerRef = useRef(null);
  const dropinInstanceRef = useRef(null);
  const dropinCheckoutRef = useRef(null);
  const [dropinLoading, setDropinLoading] = useState(false);
  const [dropinError, setDropinError] = useState("");
  const orderRef = useRef(acquiredFlight);
  useEffect(() => {
    orderRef.current = acquiredFlight;
  }, [acquiredFlight]);

  useEffect(() => {
    let cancelled = false;
    const teardown = () => {
      if (dropinInstanceRef.current) {
        try { dropinInstanceRef.current.unmount(); } catch { /* noop */ }
        dropinInstanceRef.current = null;
      }
      dropinCheckoutRef.current = null;
    };

    if (!acquiredFlight) {
      teardown();
      setDropinError("");
      setDropinLoading(false);
      return () => {
        cancelled = true;
        teardown();
      };
    }

    async function mountDropin() {
      teardown();
      setDropinError("");
      setDropinLoading(true);
      try {
        const dropinAmount = acquiredFlight.amountMinor;
        const dropinCurrency = acquiredFlight.currency;
        const [keyData, paymentMethodsResponse] = await Promise.all([
          trackedFetch("/api/adyen/checkout/client-key"),
          trackedFetch("/api/adyen/checkout/payment-methods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: dropinAmount, currency: dropinCurrency }),
          }),
        ]);
        if (cancelled) return;
        const clientKey = keyData?.clientKey;
        if (!clientKey) throw new Error("Missing Adyen client key");

        const [adyenModule] = await Promise.all([
          import("@adyen/adyen-web"),
          import("@adyen/adyen-web/styles/adyen.css"),
        ]);
        if (cancelled) return;
        const { AdyenCheckout, Dropin, Card } = adyenModule;

        const checkout = await AdyenCheckout({
          environment: "test",
          clientKey,
          paymentMethodsResponse,
          countryCode: "US",
          locale: "en-US",
          amount: { value: dropinAmount, currency: dropinCurrency },
          risk: { enabled: false },
          analytics: { enabled: false },
          onSubmit: async (state, component, actions) => {
            try {
              if (!state?.isValid) return;
              const payload = await trackedFetch("/api/adyen/checkout/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount: dropinAmount,
                  currency: dropinCurrency,
                  reference: `virtual card payment ${(window.crypto || crypto).randomUUID()}`,
                  stateData: state.data,
                  additionalData: { customRoutingFlag: "adyenIssuedTestCard" },
                  origin: window.location.origin,
                  returnUrl: `${window.location.origin}/checkout`,
                }),
              });
              const safe = {
                resultCode: payload?.resultCode,
                action: payload?.action,
                order: payload?.order,
              };
              if (actions?.resolve) {
                actions.resolve(safe);
              } else if (safe.action) {
                component.handleAction(safe.action);
              }
            } catch (err) {
              console.error("[dropin] /payments error:", err);
              if (actions?.reject) actions.reject();
            }
          },
          onAdditionalDetails: async (state, component, actions) => {
            try {
              const payload = await trackedFetch("/api/adyen/checkout/payments/details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(state.data),
              });
              const safe = {
                resultCode: payload?.resultCode,
                action: payload?.action,
                order: payload?.order,
              };
              if (actions?.resolve) {
                actions.resolve(safe);
              } else if (safe.action) {
                component.handleAction(safe.action);
              }
            } catch (err) {
              console.error("[dropin] /payments/details error:", err);
              showError(getApiErrorMessage(err) || "3DS step failed");
              actions?.reject?.();
            }
          },
          onPaymentCompleted: (result) => {
            if (result?.resultCode === "Authorised") {
              showSuccess(`Card payment ${formatCurrency(dropinAmount, dropinCurrency)} authorised`);
            } else {
              showError(`Payment ${result?.resultCode || "did not complete"}`);
            }
          },
          onPaymentFailed: (result) => {
            showError(`Payment ${result?.resultCode || "failed"}${result?.refusalReason ? `: ${result.refusalReason}` : ""}`);
          },
          onError: (err) => {
            console.error("[dropin] error:", err);
            if (err?.name !== "CANCEL") showError(err?.message || "Drop-in error");
          },
        });
        if (cancelled) return;
        dropinCheckoutRef.current = checkout;
        if (!dropinContainerRef.current) return;
        const dropinConfig = {
          onReady: () => {},
          paymentMethodsConfiguration: {
            card: {
              hasHolderName: true,
              holderNameRequired: true,
              showFormInstruction: false,
            },
          },
          paymentMethodComponents: Card ? [Card] : [],
        };
        const dropin = Dropin
          ? new Dropin(checkout, dropinConfig)
          : checkout.create("dropin", dropinConfig);
        dropin.mount(dropinContainerRef.current);
        dropinInstanceRef.current = dropin;
      } catch (e) {
        if (!cancelled) setDropinError(getApiErrorMessage(e) || "Failed to load Drop-in");
      } finally {
        if (!cancelled) setDropinLoading(false);
      }
    }

    mountDropin();
    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquiredFlight, trackedFetch]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Checkout" subtitle="Acquire a flight and satisfy the demand with an issued card purchase" />

      <section className="ca-panel">
        <h2 className="ca-section-title">Acquire</h2>
        <p className="ca-muted -mt-2 mb-4">Start by acquiring funds to your balance account for a fictitious flight</p>
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-start">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-3">
          <div className="w-full overflow-hidden rounded-xl border border-black bg-black text-white shadow-soft">
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Carrier</p>
                <p className="text-sm font-semibold leading-tight">{order.airlineName}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Flight</p>
                <p className="font-mono text-sm font-semibold leading-tight tracking-[0.08em]">{order.flightDisplay}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">From</p>
                <p className="mt-0.5 font-mono text-3xl font-bold leading-none tracking-wider">{order.origin.code}</p>
                <p className="mt-1 text-[11px] text-white/70">{order.origin.city}</p>
              </div>
              <div className="flex flex-col items-center px-1 text-white/80">
                <span aria-hidden="true" className="text-xl leading-none">✈</span>
                <span className="mt-1 h-px w-8 bg-white/30" />
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">To</p>
                <p className="mt-0.5 font-mono text-3xl font-bold leading-none tracking-wider">{order.destination.code}</p>
                <p className="mt-1 text-[11px] text-white/70">{order.destination.city}</p>
              </div>
            </div>
            <div className="flex items-end justify-between border-t border-white/15 px-4 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Total</p>
                <p className="text-xl font-bold leading-tight tabular-nums">{orderAmount}</p>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{order.flightCode}</p>
            </div>
          </div>
          <div className="flex justify-start gap-2">
            <button type="button" className="ca-button-secondary h-10 px-5" onClick={randomizeOrder} disabled={acquiring}>
              New Flight
            </button>
            <button type="button" className="ca-button-dark h-10 px-5" onClick={acquireFlight} disabled={acquiring}>
              {acquiring ? "Acquiring…" : "Acquire Flight"}
            </button>
          </div>
        </div>

        {acquiredFlight ? (
          <div className="flex w-full max-w-sm flex-col items-stretch gap-3">
            <div className="w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8FAFD] text-[#0B0B0B] shadow-soft">
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6B84]">Carrier</p>
                  <p className="text-sm font-semibold leading-tight">{acquiredFlight.airlineName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6B84]">Flight</p>
                  <p className="font-mono text-sm font-semibold leading-tight tracking-[0.08em]">
                    {acquiredFlight.flightDisplay}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-5">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6B84]">From</p>
                  <p className="mt-0.5 font-mono text-3xl font-bold leading-none tracking-wider">
                    {acquiredFlight.origin.code}
                  </p>
                  <p className="mt-1 text-[11px] text-[#5C6B84]">{acquiredFlight.origin.city}</p>
                </div>
                <div className="flex flex-col items-center px-1 text-[#5C6B84]">
                  <span aria-hidden="true" className="text-xl leading-none">✈</span>
                  <span className="mt-1 h-px w-8 bg-black/20" />
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6B84]">To</p>
                  <p className="mt-0.5 font-mono text-3xl font-bold leading-none tracking-wider">
                    {acquiredFlight.destination.code}
                  </p>
                  <p className="mt-1 text-[11px] text-[#5C6B84]">{acquiredFlight.destination.city}</p>
                </div>
              </div>
              <div className="flex items-end justify-between border-t border-black/10 px-4 py-2.5">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5C6B84]">Amount</p>
                  <p className="text-xl font-bold leading-tight tabular-nums">
                    {formatCurrency(acquiredFlight.amountMinor, acquiredFlight.currency)}
                  </p>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C6B84]">
                  {acquiredFlight.flightCode}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        </div>

      </section>

      <CardWalletViewer
        cards={cards}
        loading={cardsLoading}
        error={cardsError}
        revealByCardId={revealByCardId}
        revealLoadingByCardId={revealLoadingByCardId}
        revealErrorByCardId={revealErrorByCardId}
        onRevealCardDetails={revealCardDetails}
        onRetry={loadCards}
        title="Wallet"
        subtitle=""
      />

      {acquiredFlight ? (
        <section className="ca-panel">
          <h2 className="ca-section-title">Pay</h2>
          <p className="ca-muted -mt-2 mb-4">
            Copy a card from your wallet above and pay{" "}
            {formatCurrency(acquiredFlight.amountMinor, acquiredFlight.currency)} for {acquiredFlight.airlineName}{" "}
            {acquiredFlight.flightDisplay} ({acquiredFlight.origin.code} → {acquiredFlight.destination.code}).
          </p>
          <div className="mx-auto w-full max-w-md">
            {dropinLoading ? <p className="ca-muted text-center">Loading payment form…</p> : null}
            {dropinError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dropinError}</div>
            ) : null}
            <div id="dropin-container" ref={dropinContainerRef} />
          </div>
        </section>
      ) : null}

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
