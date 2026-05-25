"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CardWalletViewer from "@/components/CardWalletViewer";
import { CardNetworkBrandMark } from "@/components/CardNetworkLogos";
import Toast, { useToast } from "@/components/Toast";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiError";

const MAX_PAYMENT_INSTRUMENTS = 4;
const DEFAULT_BA_REFERENCE = "BA329CX22322BT5PFDPVRDHF9";
const CARD_BRANDS = [
  {
    value: "visa",
    label: "Visa",
    accent: "from-[#1A1F71] via-[#1434CB] to-[#F7B600]",
    selectedBorder: "border-[#1434CB]",
    selectedBackground: "bg-gradient-to-r from-[#EEF3FF] to-[#FFF8E4]",
    selectedShadow: "shadow-[0_8px_20px_rgba(20,52,203,0.2)]",
    slotFill: "bg-gradient-to-r from-[#1A1F71] via-[#1434CB] to-[#F7B600]",
  },
  {
    value: "mc",
    label: "Mastercard",
    accent: "from-[#EB001B] via-[#FF5F00] to-[#F79E1B]",
    selectedBorder: "border-[#EB001B]",
    selectedBackground: "bg-gradient-to-r from-[#FFF0EC] via-[#FFF3EA] to-[#FFF7E8]",
    selectedShadow: "shadow-[0_8px_20px_rgba(235,0,27,0.18)]",
    slotFill: "bg-gradient-to-r from-[#EB001B] via-[#FF5F00] to-[#F79E1B]",
  },
];

function resolveBrandValue(card) {
  const rawBrand = String(card?.card?.brand || card?.brand || "").toLowerCase();
  if (rawBrand.includes("visa")) return "visa";
  if (rawBrand.includes("mc") || rawBrand.includes("master")) return "mc";
  return "";
}

export default function CardsContent() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const { toast, clearToast, showError, showSuccess } = useToast();
  const [brand, setBrand] = useState("visa");
  const [reference, setReference] = useState("");
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [revealByCardId, setRevealByCardId] = useState({});
  const [revealLoadingByCardId, setRevealLoadingByCardId] = useState({});
  const [revealErrorByCardId, setRevealErrorByCardId] = useState({});
  const cardsCount = cards.length;
  const availableSlots = Math.max(MAX_PAYMENT_INSTRUMENTS - cardsCount, 0);
  const canCreateMoreCards = availableSlots > 0;
  const isIssueCardDisabled = isCreating || !canCreateMoreCards;
  const selectedBrandConfig = useMemo(
    () => CARD_BRANDS.find((item) => item.value === brand) || CARD_BRANDS[0],
    [brand]
  );

  const loadCards = useCallback(async () => {
    if (!user?.balanceAccountId) {
      setCards([]);
      setCardsError("Missing balance account ID in session.");
      setCardsLoading(false);
      return;
    }

    setCardsLoading(true);
    setCardsError("");
    try {
      const payload = await trackedFetch(`/api/adyen/cards?balanceAccountId=${user.balanceAccountId}`);
      const list = payload?.paymentInstruments || [];
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
      const message = getApiErrorMessage(error);
      setCards([]);
      setCardsError(message);
      showError(message);
    } finally {
      setCardsLoading(false);
    }
  }, [showError, trackedFetch, user?.balanceAccountId]);

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

  const createCard = async (event) => {
    event.preventDefault();
    if (!canCreateMoreCards) return;
    if (!user?.balanceAccountId) {
      showError("Missing balance account ID in session.");
      return;
    }

    try {
      setIsCreating(true);
      setCardsError("");
      const created = await trackedFetch("/api/adyen/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balanceAccountId: user.balanceAccountId,
          brand,
          reference: reference.trim(),
        }),
      });
      const createdBrand = String(created?.card?.brand || brand).toLowerCase();
      const brandLabel = createdBrand === "visa" ? "Visa" : "Mastercard";
      const lastFour = created?.card?.lastFour || "";
      const createdReference = created?.reference || "";
      let message = `${brandLabel} ${lastFour} created successfully!`;
      if (createdReference) {
        message += ` with ${createdReference}`;
      }
      showSuccess(message);
      setReference("");
      await loadCards();
    } catch (error) {
      const rawMessage = getApiErrorMessage(error) || "";
      const isMissingCapability = /capabilit(y|ies)/i.test(rawMessage) || /not allowed/i.test(rawMessage);
      const message = isMissingCapability
        ? "Card issuing isn't enabled yet because this account holder hasn't completed onboarding. Adyen requires verified KYB/KYC info before the issueCardCommercial capability is granted. Open the Onboarding tab and launch Hosted Onboarding to submit the required business and signatory details — once Adyen marks the capability as allowed, card creation will work."
        : rawMessage || "Failed to create card.";
      setCardsError(message);
      showError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <h2 className="ca-section-title">Issue card</h2>
        <p className="mt-1 text-sm text-[#5C6B84]">
          Create up to {MAX_PAYMENT_INSTRUMENTS} payment instruments to spend funds from{" "}
          {user?.balanceAccountId || DEFAULT_BA_REFERENCE}
        </p>
        <form onSubmit={createCard} className="mt-5 space-y-5">
          <div>
            <div className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5C6B84]">Network</p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {CARD_BRANDS.map((option) => {
                  const isSelected = brand === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBrand(option.value)}
                      disabled={isCreating}
                      aria-label={option.label}
                      aria-pressed={isSelected}
                      className={`flex min-h-[4.5rem] items-center justify-center rounded-xl border p-3 transition ${
                        isSelected
                          ? `${option.selectedBorder} ${option.selectedBackground} ${option.selectedShadow}`
                          : "border-[#E2E8F0] bg-[#F8FAFD] hover:border-[#B8C4D9]"
                      } ${isCreating ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <span className="flex flex-1 items-center justify-center" aria-hidden="true">
                        <CardNetworkBrandMark brand={option.value} tone="onLight" size="picker" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: MAX_PAYMENT_INSTRUMENTS }).map((_, index) => {
              const slotCard = cards[index];
              const isFilled = Boolean(slotCard);
              const slotBrand = resolveBrandValue(slotCard);
              const slotBrandConfig = CARD_BRANDS.find((item) => item.value === slotBrand);
              return (
                <div
                  key={`slot-${index}`}
                  className={`h-2 rounded-full ${
                    isFilled ? slotBrandConfig?.slotFill || "bg-[#64748B]" : "bg-[#E2E8F0]"
                  }`}
                  aria-hidden="true"
                />
              );
            })}
          </div>

          <div className="md:max-w-2xl">
            <label
              htmlFor="card-reference"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5C6B84]"
            >
              Card Reference (optional)
            </label>
            <input
              id="card-reference"
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="ca-input mt-2 h-11 text-sm"
              placeholder="order 24601"
              disabled={isCreating}
              maxLength={20}
            />
            <button
              type="submit"
              className="ca-button mt-4 h-11 w-full text-sm sm:w-auto sm:px-6"
              disabled={isIssueCardDisabled}
            >
              {isCreating ? "Creating..." : "Issue payment instrument"}
            </button>
            <p className="mt-2 text-xs font-semibold text-[#5C6B84]">
              {!canCreateMoreCards
                ? `${cardsCount}/${MAX_PAYMENT_INSTRUMENTS} issued: wallet full!`
                : `${cardsCount}/${MAX_PAYMENT_INSTRUMENTS} issued`}
            </p>
          </div>
        </form>
      </section>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
