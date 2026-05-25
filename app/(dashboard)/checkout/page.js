"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import CardWalletViewer from "@/components/CardWalletViewer";
import PageHeader from "@/components/PageHeader";
import Toast, { useToast } from "@/components/Toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatCurrency, generateOrderReference } from "@/lib/utils";

const TOURIST_CITIES = [
  "Paris",
  "Tokyo",
  "Rome",
  "New York",
  "London",
  "Barcelona",
  "Dubai",
  "Singapore",
  "Sydney",
  "Istanbul",
];
const UPSCALE_HOTELS = [
  "The Grand Regent",
  "Palais Royale Suites",
  "Azure Crown Hotel",
  "Imperial Orchid Residence",
  "The Starlight Conservatory",
  "Velvet Bay Manor",
  "Sapphire Atrium",
  "The Windsor Meridian",
];
const ADVENTURE_ITEMS = [
  "Canyon Zipline Expedition",
  "Glacier Helicopter Trek",
  "Volcano Sunset Hike",
  "Desert Dune Rally",
  "Rainforest Canopy Climb",
  "Coastal Cliff Paraglide",
  "Alpine Summit Traverse",
  "Jungle River Kayak Quest",
  "Luxury Safari Game Drive",
  "Jungle Exploration Trek",
  "Starlight Mountain Camping Retreat",
  "Highland Mountain Exploration Hike",
  "Arctic Wilderness Survival Camp",
  "Waterfall Canyoning Expedition",
  "Remote Island Snorkel Adventure",
  "Ancient Forest Night Trail Experience",
];
const TRAVEL_EXPERIENCES = [
  "City Museum Discovery Pass",
  "Harbor Sunset Cruise",
  "Private Landmark Photo Tour",
  "Luxury Rail Day Journey",
  "Cultural Food & Markets Walk",
  "Historic District Night Tour",
  "Island Lighthouse Excursion",
  "VIP Skyline Observation Entry",
  "Sunrise Temple & Heritage Tour",
  "Old Town Architecture Walking Experience",
  "World Heritage Sites Day Trip",
  "Royal Palace & Art Collection Visit",
];
const WORLD_WONDERS_AND_ATTRACTIONS = [
  "Machu Picchu Sunrise Guided Tour",
  "Great Wall of China Scenic Trek Pass",
  "Petra Historic Canyon Entry",
  "Colosseum & Roman Forum VIP Access",
  "Taj Mahal Moonlight Viewing Experience",
  "Chichen Itza Archaeology Discovery Tour",
  "Christ the Redeemer Summit Excursion",
  "Pyramids of Giza Desert Heritage Visit",
  "Acropolis of Athens Expert-Led Tour",
  "Angkor Wat Temple Circuit Experience",
  "Stonehenge Solstice Visitor Package",
  "Easter Island Moai Cultural Journey",
];
const CUSTOM_ROUTING_FLAG = "adyenIssuedTestCard";
const SUCCESS_RESULT_CODES = new Set(["Authorised"]);
const PROCESSING_RESULT_CODES = new Set(["Pending", "Received"]);

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createFlightItem() {
  const departure = randomChoice(TOURIST_CITIES);
  const destinationOptions = TOURIST_CITIES.filter((city) => city !== departure);
  const destination = randomChoice(destinationOptions);
  return `✈️ Flight from ${departure} to ${destination}`;
}

function createHotelItem() {
  const hotel = randomChoice(UPSCALE_HOTELS);
  const city = randomChoice(TOURIST_CITIES);
  return `🏨 ${hotel} in ${city}`;
}

function createAdventureItem() {
  return `${randomChoice(["🧗", "🦁", "🌴", "🏕️", "⛰️", "🛶", "🪂", "🌋"])} ${randomChoice(ADVENTURE_ITEMS)}`;
}

function createTravelItem() {
  return `${randomChoice(["🧳", "🗺️", "📸", "🚢", "🎒", "🏛️", "🌅", "🚠"])} ${randomChoice(TRAVEL_EXPERIENCES)}`;
}

function createWonderItem() {
  return `${randomChoice(["🗿", "🕌", "🏯", "🏰", "🕍", "🧭", "📜", "🌍"])} ${randomChoice(
    WORLD_WONDERS_AND_ATTRACTIONS
  )}`;
}

function createRandomItem() {
  return randomChoice([
    createFlightItem,
    createHotelItem,
    createAdventureItem,
    createTravelItem,
    createWonderItem,
  ])();
}

function createRandomOrder() {
  return {
    item: createRandomItem(),
    amountMinor: Math.floor(Math.random() * 17501) + 2500,
    currency: "USD",
    reference: generateOrderReference(),
  };
}

function toClientSafePaymentPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  return {
    action: payload.action,
    order: payload.order,
    resultCode: payload.resultCode,
  };
}

function resolvePaymentStatus(resultCode) {
  if (SUCCESS_RESULT_CODES.has(resultCode)) return "success";
  if (PROCESSING_RESULT_CODES.has(resultCode)) return "processing";
  return "failed";
}

function getAvailableBalanceSnapshot(balanceAccount) {
  const items = balanceAccount?.balances || [];
  const usd =
    items.find((item) => (item?.currency || item?.available?.currency || item?.balance?.currency) === "USD") ||
    items[0];
  const availableValue =
    typeof usd?.available === "number" ? usd.available : Number(usd?.available?.value || usd?.balance?.value || 0);
  const currency = usd?.currency || usd?.available?.currency || usd?.balance?.currency || "USD";

  return {
    availableMinor: Number.isFinite(availableValue) ? availableValue : 0,
    currency,
  };
}

export default function CheckoutPage() {
  const { trackedFetch } = useApiHistory();
  const { user } = useAuth();
  const { toast, clearToast, showSuccess, showError } = useToast();
  const [order, setOrder] = useState(() => createRandomOrder());
  const [loadingDropin, setLoadingDropin] = useState(true);
  const [initError, setInitError] = useState("");
  const [paymentResult, setPaymentResult] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");
  const [revealByCardId, setRevealByCardId] = useState({});
  const [revealLoadingByCardId, setRevealLoadingByCardId] = useState({});
  const [revealErrorByCardId, setRevealErrorByCardId] = useState({});

  const containerRef = useRef(null);
  const dropinRef = useRef(null);
  const dropinReadyRef = useRef(false);
  const initSequenceRef = useRef(0);

  const orderAmount = useMemo(
    () => formatCurrency(order.amountMinor, order.currency),
    [order.amountMinor, order.currency]
  );

  const resolveFailureReason = useCallback(
    async ({ result, error, context }) => {
      const resultCode = result?.resultCode || "Error";
      const refusalReason = result?.refusalReason || "";
      const baseMessage =
        refusalReason || getApiErrorMessage(error) || (resultCode !== "Error" ? `Payment ${resultCode}.` : "Payment failed.");
      let userMessage = baseMessage;
      const failureDetails = {
        context,
        resultCode,
        refusalReason,
        orderReference: order.reference,
        orderAmountMinor: order.amountMinor,
        orderCurrency: order.currency,
      };

      if (user?.balanceAccountId && order.currency === "USD") {
        try {
          const overview = await trackedFetch(
            `/api/adyen/account-overview?balanceAccountId=${encodeURIComponent(user.balanceAccountId)}`
          );
          const { availableMinor, currency } = getAvailableBalanceSnapshot(overview);
          failureDetails.latestBalanceMinor = availableMinor;
          failureDetails.latestBalanceCurrency = currency;
          if (currency === order.currency && availableMinor < order.amountMinor) {
            userMessage = "Insufficient balance";
          }
        } catch (balanceError) {
          failureDetails.balanceCheckError = getApiErrorMessage(balanceError);
        }
      }

      return {
        resultCode,
        refusalReason: baseMessage,
        userMessage,
        failureDetails,
      };
    },
    [order.amountMinor, order.currency, order.reference, trackedFetch, user?.balanceAccountId]
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

  const clearDropin = useCallback(() => {
    if (dropinRef.current?.unmount && dropinReadyRef.current) {
      try {
        dropinRef.current.unmount();
      } catch (_error) {
        // Ignore teardown warnings when secured fields never finished configuring.
      }
    }
    // Do not mutate container DOM when secured fields were not fully configured yet.
    // This avoids iframe.contentWindow teardown races during fast refresh / strict-mode remounts.
    if (dropinReadyRef.current && containerRef.current) {
      containerRef.current.innerHTML = "";
    }
    dropinReadyRef.current = false;
    dropinRef.current = null;
  }, []);

  const initDropin = useCallback(async () => {
    const sequence = initSequenceRef.current + 1;
    initSequenceRef.current = sequence;
    clearDropin();

    setInitError("");
    setLoadingDropin(true);
    setPaymentResult(null);

    try {
      const configResponse = await trackedFetch("/api/adyen/checkout/client-key");
      const clientKey = configResponse?.clientKey;
      if (!clientKey) {
        throw new Error("Missing Adyen client key.");
      }

      const paymentMethodsResponse = await trackedFetch("/api/adyen/checkout/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.amountMinor,
          currency: order.currency,
        }),
      });

      const adyenModule = await import("@adyen/adyen-web");
      await import("@adyen/adyen-web/styles/adyen.css");

      if (typeof window !== "undefined" && !window.__adyenAnalyticsStubInstalled) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url = typeof input === "string" ? input : input?.url || "";
          if (url.includes("checkoutanalytics") && url.includes("adyen.com")) {
            return Promise.resolve(
              new Response(
                JSON.stringify({ checkoutAttemptId: `stub-${Date.now()}` }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          return originalFetch(input, init);
        };
        window.__adyenAnalyticsStubInstalled = true;
      }

      if (sequence !== initSequenceRef.current) return;

      const createCheckout = adyenModule.default || adyenModule.AdyenCheckout;
      if (typeof createCheckout !== "function") {
        throw new Error("Unable to initialize AdyenCheckout from @adyen/adyen-web exports.");
      }

      const checkout = await createCheckout({
        environment: "test",
        clientKey,
        risk: {
          enabled: false,
        },
        analytics: {
          enabled: false,
        },
        countryCode: "US",
        locale: "en-US",
        amount: {
          value: order.amountMinor,
          currency: order.currency,
        },
        paymentMethodsResponse,
        onSubmit: async (state, component, actions) => {
          try {
            if (!state?.isValid) return;
            const payload = await trackedFetch("/api/adyen/checkout/payments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: order.amountMinor,
                currency: order.currency,
                reference: order.reference,
                stateData: state.data,
                additionalData: {
                  customRoutingFlag: CUSTOM_ROUTING_FLAG,
                },
                origin: window.location.origin,
                returnUrl: `${window.location.origin}/checkout`,
              }),
            });

            const safePayload = toClientSafePaymentPayload(payload);
            if (actions?.resolve) {
              actions.resolve(safePayload);
            } else if (safePayload?.action) {
              component.handleAction(safePayload.action);
            }

          } catch (error) {
            const failure = await resolveFailureReason({ error, context: "onSubmit" });
            setPaymentResult({
              status: "error",
              resultCode: failure.resultCode,
              refusalReason: failure.userMessage,
            });
            showError(`Payment failed: ${failure.userMessage}`);
            console.error("Checkout payment failed", {
              userMessage: failure.userMessage,
              ...failure.failureDetails,
              rawError: error,
            });
            if (actions?.reject) actions.reject();
          }
        },
        onAdditionalDetails: async (state, _component, actions) => {
          try {
            const payload = await trackedFetch("/api/adyen/checkout/payments/details", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(state.data),
            });

            if (actions?.resolve) actions.resolve(toClientSafePaymentPayload(payload));

          } catch (error) {
            const failure = await resolveFailureReason({ error, context: "onAdditionalDetails" });
            setPaymentResult({
              status: "error",
              resultCode: failure.resultCode,
              refusalReason: failure.userMessage,
            });
            showError(`Payment failed: ${failure.userMessage}`);
            console.error("Checkout payment details failed", {
              userMessage: failure.userMessage,
              ...failure.failureDetails,
              rawError: error,
            });
            if (actions?.reject) actions.reject();
          }
        },
        onPaymentCompleted: (result) => {
          const resultCode = result?.resultCode || "Unknown";
          const status = resolvePaymentStatus(resultCode);
          const resolvedResult = {
            resultCode,
            refusalReason: result?.refusalReason || "",
          };
          setPaymentResult({
            status,
            ...resolvedResult,
          });
          if (status === "success") {
            showSuccess(
              `Payment successful!\n${order.item}\nOrder ${order.reference} · ${formatCurrency(order.amountMinor, order.currency)}`
            );
            return;
          }
          if (status === "failed") {
            const failureMessage = resolvedResult.refusalReason || `Payment ${resultCode}.`;
            showError(`Payment failed: ${failureMessage}`);
            console.error("Checkout payment not authorised", {
              context: "onPaymentCompleted",
              resultCode,
              refusalReason: resolvedResult.refusalReason,
              orderReference: order.reference,
              orderAmountMinor: order.amountMinor,
              orderCurrency: order.currency,
              rawResult: result,
            });
          }
        },
        onPaymentFailed: async (result) => {
          const failure = await resolveFailureReason({ result, context: "onPaymentFailed" });
          const resolvedResult = {
            resultCode: failure.resultCode || "Refused",
            refusalReason: failure.userMessage,
          };
          setPaymentResult({
            status: "failed",
            ...resolvedResult,
          });
          showError(`Payment failed: ${failure.userMessage}`);
          console.error("Checkout payment failed", {
            userMessage: failure.userMessage,
            ...failure.failureDetails,
            rawResult: result,
          });
        },
        onError: (error) => {
          const message = error?.message || "Drop-in error";
          setPaymentResult({
            status: "error",
            resultCode: "Error",
            refusalReason: message,
          });
          showError(`Payment error: ${message}`);
          console.error("Checkout drop-in error", {
            context: "onError",
            orderReference: order.reference,
            orderAmountMinor: order.amountMinor,
            orderCurrency: order.currency,
            message,
            rawError: error,
          });
        },
      });

      if (sequence !== initSequenceRef.current) return;

      const DropinCtor = adyenModule.Dropin;
      const CardComponent = adyenModule.Card;
      const dropinConfig = {
        onReady: () => {
          // Keep for overall drop-in readiness.
        },
        paymentMethodsConfiguration: {
          card: {
            hasHolderName: true,
            holderNameRequired: true,
            showFormInstruction: false,
            onConfigSuccess: () => {
              // Secured fields are fully configured only after this callback.
              dropinReadyRef.current = true;
            },
          },
        },
        paymentMethodComponents: CardComponent ? [CardComponent] : [],
      };
      if (DropinCtor) {
        dropinRef.current = new DropinCtor(checkout, dropinConfig);
      } else {
        dropinRef.current = checkout.create("dropin", dropinConfig);
      }
      dropinRef.current.mount(containerRef.current);
      setLoadingDropin(false);
    } catch (error) {
      if (sequence !== initSequenceRef.current) return;
      setInitError(error.message || "Unable to initialize checkout.");
      setLoadingDropin(false);
    }
  }, [
    clearDropin,
    order.amountMinor,
    order.currency,
    order.reference,
    resolveFailureReason,
    showError,
    showSuccess,
    trackedFetch,
  ]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

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

  useEffect(() => {
    initDropin();
    return () => {
      // Invalidate any in-flight initialization before teardown.
      initSequenceRef.current += 1;
      clearDropin();
    };
  }, [clearDropin, initDropin]);

  const randomizeOrder = () => {
    setOrder(createRandomOrder());
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Checkout" subtitle="Simulate a checkout purchase with your issued card" />

      <section className="ca-panel">
        <h2 className="ca-section-title">Order</h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-2xl rounded-lg bg-[#F8FAFD] p-4">
            <div className="space-y-2">
              <p className="text-lg font-extrabold leading-tight text-[#0B1222] md:text-xl">{order.item}</p>
              <p className="text-xl font-extrabold text-[#0B1222]">Amount: {orderAmount}</p>
              <p className="break-all text-sm font-medium text-[#334155]">Reference: {order.reference}</p>
            </div>
          </div>
          <button type="button" className="ca-button-dark h-10" onClick={randomizeOrder}>
            Randomize
          </button>
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

      <section className="ca-panel">
        <h2 className="ca-section-title">Checkout</h2>
        <div className="rounded-xl bg-white p-4">
          {loadingDropin ? <p className="text-sm text-[#5C6B84]">Initializing secure payment form...</p> : null}
          {initError ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p>{initError}</p>
              <button type="button" className="ca-button-secondary mt-3 h-9" onClick={initDropin}>
                Retry
              </button>
            </div>
          ) : null}
          <div id="dropin-container" ref={containerRef} />
        </div>
      </section>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
