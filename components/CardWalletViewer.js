"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CardNetworkBrandMark, isVisaBrand } from "@/components/CardNetworkLogos";

function cardGradient(brand) {
  const normalized = String(brand || "").toLowerCase();
  if (normalized.includes("visa")) {
    return "from-[#1A1F71] via-[#1434CB] to-[#0E1858]";
  }
  return "from-[#1A0A0F] via-[#3D0A14] to-[#7A1525]";
}

function formatPan(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(expiration) {
  const monthRaw = String(expiration?.month || "");
  const month = monthRaw ? monthRaw.padStart(2, "0") : "";
  const yearRaw = String(expiration?.year || "");
  const year = yearRaw.length >= 2 ? yearRaw.slice(-2) : yearRaw;
  if (!month || !year) return "";
  return `${month}/${year}`;
}

function formatCardReference(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, 20);
}

const SWIPE_THRESHOLD = 48;

export default function CardWalletViewer({
  cards = [],
  loading = false,
  error = "",
  revealByCardId = {},
  revealLoadingByCardId = {},
  revealErrorByCardId = {},
  onRevealCardDetails,
  onRetry,
  title = "Wallet",
  subtitle = "",
}) {
  const walletCards = useMemo(() => cards.slice(0, 4), [cards]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState("next");
  const [revealedCardIds, setRevealedCardIds] = useState({});
  const touchStartXRef = useRef(null);
  const previousWalletCardIdsRef = useRef([]);

  useEffect(() => {
    if (!walletCards.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > walletCards.length - 1) {
      setActiveIndex(walletCards.length - 1);
    }
  }, [activeIndex, walletCards.length]);

  useEffect(() => {
    const previousIds = previousWalletCardIdsRef.current;
    const currentIds = walletCards.map((card) => card?.id).filter(Boolean);
    previousWalletCardIdsRef.current = currentIds;

    // When a new card appears in the first 4 payment instruments, focus it.
    if (!previousIds.length || currentIds.length <= previousIds.length) {
      return;
    }
    const newlyAddedCardId = currentIds.find((id) => !previousIds.includes(id));
    if (!newlyAddedCardId) return;
    const nextIndex = walletCards.findIndex((card) => card?.id === newlyAddedCardId);
    if (nextIndex < 0) return;
    setSlideDirection(nextIndex >= activeIndex ? "next" : "prev");
    setActiveIndex(nextIndex);
  }, [activeIndex, walletCards]);

  useEffect(() => {
    const cardIds = new Set(walletCards.map((card) => card?.id).filter(Boolean));
    setRevealedCardIds((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([cardId]) => cardIds.has(cardId)))
    );
  }, [walletCards]);

  const activeCard = walletCards[activeIndex];
  const activeCardId = activeCard?.id || "";
  const cachedReveal = activeCardId ? revealByCardId[activeCardId] : null;
  const isRevealed = Boolean(activeCardId && revealedCardIds[activeCardId] && cachedReveal?.pan);
  const revealLoading = Boolean(activeCardId && revealLoadingByCardId[activeCardId]);
  const revealError = activeCardId ? revealErrorByCardId[activeCardId] || "" : "";
  const canRotate = walletCards.length > 1;

  const cardNumber = useMemo(() => {
    if (isRevealed && cachedReveal?.pan) {
      return formatPan(cachedReveal.pan);
    }
    const lastFour = activeCard?.card?.lastFour || "••••";
    return `•••• •••• •••• ${lastFour}`;
  }, [activeCard?.card?.lastFour, cachedReveal?.pan, isRevealed]);

  const expiry = isRevealed ? formatExpiry(cachedReveal?.expiration) || "—" : "••/••";
  const cvc = isRevealed ? cachedReveal?.cvc || "—" : "•••";
  const cardReference = formatCardReference(activeCard?.reference);

  const goNext = () => {
    if (!canRotate) return;
    setSlideDirection("next");
    setActiveIndex((prev) => (prev + 1) % walletCards.length);
  };

  const goPrev = () => {
    if (!canRotate) return;
    setSlideDirection("prev");
    setActiveIndex((prev) => (prev - 1 + walletCards.length) % walletCards.length);
  };

  const toggleReveal = async () => {
    if (!activeCardId || revealLoading) return;

    const currentlyVisible = Boolean(revealedCardIds[activeCardId]);
    if (currentlyVisible) {
      // Allow users to obscure sensitive fields again.
      setRevealedCardIds((prev) => ({ ...prev, [activeCardId]: false }));
      return;
    }

    const hasRevealData = Boolean(cachedReveal?.pan);
    if (!hasRevealData && onRevealCardDetails) {
      const response = await onRevealCardDetails(activeCardId);
      if (!response?.pan) return;
    }

    setRevealedCardIds((prev) => ({ ...prev, [activeCardId]: true }));
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (!canRotate || touchStartXRef.current === null) return;
    const touchEndX = event.changedTouches?.[0]?.clientX ?? touchStartXRef.current;
    const deltaX = touchEndX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX > 0) {
      goPrev();
      return;
    }
    goNext();
  };

  const handleKeyDown = (event) => {
    if (!canRotate) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  return (
    <section className="ca-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="ca-section-title">{title}</h2>
          {subtitle ? <p className="ca-muted mt-1">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="mx-auto w-full max-w-[460px] rounded-[28px] border border-[#D8E2F2] bg-gradient-to-br from-[#F9FBFF] via-[#F0F5FF] to-[#F8FAFF] p-5 shadow-[0_30px_70px_-42px_rgba(26,48,92,0.28)]">
            <div className="relative mx-auto h-[220px] w-full max-w-[360px] overflow-hidden rounded-2xl border border-[#D6E2F8] bg-gradient-to-br from-[#E6EEFF] via-[#DCE8FF] to-[#EAF1FF]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.65),transparent_58%)]" />
              <div className="card-wallet-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            {onRetry ? (
              <button type="button" className="ca-button-secondary mt-3 h-9" onClick={onRetry}>
                Retry
              </button>
            ) : null}
          </div>
        ) : walletCards.length === 0 ? (
          <div className="mx-auto w-full max-w-[460px] rounded-[28px] border border-[#D8E2F2] bg-gradient-to-br from-[#F9FBFF] via-[#F0F5FF] to-[#F8FAFF] p-6 text-center shadow-[0_30px_70px_-42px_rgba(26,48,92,0.28)]">
            <div className="mx-auto h-[180px] w-full max-w-[300px] rounded-2xl border border-dashed border-[#B7C7E6] bg-[#EDF3FF]" />
            <p className="mt-4 text-base font-semibold text-[#0F1D3D]">No cards issued yet</p>
          </div>
        ) : (
          <>
            <div className="group relative mx-auto w-full max-w-[460px] overflow-visible px-2 py-3 md:px-3">
              <div className="pointer-events-none absolute inset-x-10 top-2 h-[250px] rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(56,118,242,0.16),rgba(56,118,242,0.05)_45%,transparent_72%)] blur-2xl" />
              <div
                role="region"
                aria-label="Card wallet carousel"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="relative z-10 outline-none"
              >
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canRotate}
                  aria-label="Previous card"
                  className="absolute -left-12 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#C8D6EE] bg-white text-3xl text-[#233A66] shadow-[0_18px_38px_-26px_rgba(20,43,88,0.7)] transition hover:scale-105 hover:text-[#0F1D3D] disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex md:-left-14"
                >
                  <span>‹</span>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canRotate}
                  aria-label="Next card"
                  className="absolute -right-12 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#C8D6EE] bg-white text-3xl text-[#233A66] shadow-[0_18px_38px_-26px_rgba(20,43,88,0.7)] transition hover:scale-105 hover:text-[#0F1D3D] disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex md:-right-14"
                >
                  <span>›</span>
                </button>

                <div className="relative mx-auto h-[252px] w-full max-w-[380px] [perspective:1200px]">
                  {walletCards.length >= 3 ? (
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-0 top-0 h-[220px] w-full rounded-2xl bg-gradient-to-br ${cardGradient(
                        activeCard?.card?.brand
                      )} border border-white/10 opacity-25 shadow-[0_18px_34px_-26px_rgba(11,18,34,0.65)] transition-all duration-500 [transform:translateX(3px)_translateY(6px)_scale(0.96)] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]`}
                    />
                  ) : null}
                  {walletCards.length >= 2 ? (
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-0 top-0 h-[220px] w-full rounded-2xl bg-gradient-to-br ${cardGradient(
                        activeCard?.card?.brand
                      )} border border-white/12 opacity-50 shadow-[0_22px_40px_-28px_rgba(11,18,34,0.7)] transition-all duration-500 [transform:translateX(2px)_translateY(4px)_scale(0.98)] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]`}
                    />
                  ) : null}

                  <div
                    key={`${activeCardId || "card"}-${activeIndex}-${slideDirection}`}
                    className={`relative mx-auto h-[220px] w-full rounded-2xl bg-gradient-to-br ${cardGradient(
                      activeCard?.card?.brand
                    )} ${slideDirection === "prev" ? "card-wallet-slide-in-prev" : "card-wallet-slide-in-next"} p-4 text-white shadow-[0_24px_60px_-24px_rgba(11,18,34,0.88)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_36px_80px_-30px_rgba(11,18,34,0.95)] sm:p-5`}
                  >
                    <div className="flex h-10 items-center justify-between gap-4">
                      <div className="h-10 w-14 shrink-0 rounded-md bg-gradient-to-br from-[#D9B45A] to-[#A68235]" />
                      <div className="flex h-10 min-w-0 shrink-0 items-center justify-end text-right">
                        <CardNetworkBrandMark brand={activeCard?.card?.brand} tone="onDark" size="wallet" />
                      </div>
                    </div>
                    <p className="mt-10 whitespace-nowrap font-mono text-[16px] tracking-[0.1em] sm:text-[22px] sm:tracking-[0.16em]">{cardNumber}</p>
                    <div className="mt-8 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-white/75">Expiry</p>
                        <p className="text-sm font-semibold">{expiry}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-white/75">CVC</p>
                        <p className="text-sm font-semibold">{cvc}</p>
                      </div>
                    </div>
                    {cardReference ? (
                      <p className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 truncate text-[11px] uppercase tracking-[0.14em] text-white/80">
                        {cardReference}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mx-auto mt-5 flex w-full max-w-[380px] items-center rounded-full border border-[#CFDAEE] bg-white/70 px-2 py-2 backdrop-blur-xl sm:px-3">
                  <div className="flex flex-1 items-center gap-2">
                    {walletCards.map((card, index) => (
                      <button
                        key={card.id || `dot-${index}`}
                        type="button"
                        aria-label={`Go to card ${index + 1}`}
                        onClick={() => {
                          if (index === activeIndex) return;
                          setSlideDirection(index > activeIndex ? "next" : "prev");
                          setActiveIndex(index);
                        }}
                        className={`rounded-full transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
                          index === activeIndex ? "h-2.5 w-7 bg-black" : "h-2.5 w-2.5 bg-[#A6B7D5] hover:bg-[#8EA3C8]"
                        }`}
                      />
                    ))}
                    {walletCards.length >= 4 ? (
                      <span className="ml-1 hidden rounded-full border border-[#CFDAEE] bg-[#EAF0FB] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#4C5E7E] sm:inline-flex">
                        {activeIndex + 1} of {walletCards.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mx-2 h-5 w-px bg-[#CFDAEE] sm:mx-3" />

                  <button
                    type="button"
                    onClick={toggleReveal}
                    disabled={!activeCardId || revealLoading}
                    className={`inline-flex h-8 min-w-[84px] flex-1 items-center justify-center gap-2 rounded-full px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRevealed ? "bg-[#EAF0FB] text-[#1B2C4C]" : "bg-[#E1F5EA] text-[#10633A]"
                    }`}
                  >
                    {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    {revealLoading ? (
                      <span>Loading</span>
                    ) : (
                      <span className="relative inline-flex h-4 w-8 items-center overflow-hidden text-left">
                        <span
                          className={`absolute inset-0 transition-all duration-200 ${
                            isRevealed ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
                          }`}
                        >
                          Show
                        </span>
                        <span
                          className={`absolute inset-0 transition-all duration-200 ${
                            isRevealed ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                          }`}
                        >
                          Hide
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-2 flex w-full max-w-[380px] justify-end">
              {revealError ? <p className="text-xs text-red-600">{revealError}</p> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
