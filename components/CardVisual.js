"use client";

import { useMemo } from "react";
import CopyButton from "@/components/CopyButton";

function formatPan(pan = "") {
  return pan.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export default function CardVisual({ card, revealed, onToggleReveal, onSelect }) {
  const isVisa = (card?.card?.brand || "").toLowerCase().includes("visa");
  const pan = card?.fullDetails?.pan || "";
  const masked = `•••• •••• •••• ${card?.card?.lastFour || "••••"}`;
  const number = revealed && pan ? formatPan(pan) : masked;

  const bgStyle = useMemo(
    () =>
      isVisa
        ? "from-[#0A2A7A] via-[#154AA4] to-[#102B62]"
        : "from-[#5F1022] via-[#A62C2C] to-[#E68A00]",
    [isVisa]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`w-full rounded-2xl bg-gradient-to-br ${bgStyle} p-5 text-left text-white shadow-soft`}
    >
      <div className="flex items-start justify-between">
        <div className="h-9 w-14 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500" />
        <div className="text-sm font-bold tracking-wide">{isVisa ? "VISA" : "MC"}</div>
      </div>

      <div className="mt-7 font-mono text-lg tracking-widest transition-opacity duration-200">{number}</div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-xs text-white/70">CARDHOLDER</p>
          <p className="text-sm font-semibold">{card?.card?.cardholderName || "Cardholder"}</p>
          {revealed ? (
            <p className="mt-1 text-xs text-white/80">
              EXP {card?.fullDetails?.expiryMonth || "—"}/{card?.fullDetails?.expiryYear || "—"} | CVC{" "}
              {card?.fullDetails?.cvc || "—"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {revealed && pan ? <CopyButton value={pan} label="Copy PAN" /> : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReveal();
            }}
            className="rounded-full bg-white/20 px-2 py-1 text-xs"
          >
            {revealed ? "👁‍🗨" : "👁"}
          </button>
        </div>
      </div>
    </div>
  );
}

