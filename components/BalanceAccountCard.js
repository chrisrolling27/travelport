"use client";

import { formatCurrency } from "@/lib/utils";

const MUTED = "text-[#70819D]";
const BORDER = "border-[#E4E9F2]";
const TILE_BG = "bg-[#F8FAFD]";
const PANEL =
  "flex flex-col rounded-xl border border-[#E4E9F2] bg-white p-4 shadow-sm sm:p-5";

function MetricTile({ label, value }) {
  return (
    <div className={`min-w-0 w-full rounded-md ${TILE_BG} p-2.5 sm:p-3`}>
      <p className={`text-[11px] ${MUTED}`}>{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-[#0B1222] sm:text-base">
        {value}
      </p>
    </div>
  );
}

export default function BalanceAccountCard({
  balanceMinorUnits,
  availableMinorUnits,
  pendingMinorUnits = 0,
  currency = "USD",
  cardsIssued = 0,
  cardsCapacity = 4,
  balanceAccountId,
  accountHolderId,
  transferInstrumentId,
  className = "",
}) {
  const ids = [
    { key: "balance", label: "Balance Account ID", value: balanceAccountId || "—" },
    { key: "holder", label: "Account Holder ID", value: accountHolderId || "—" },
    { key: "transfer", label: "Transfer Instrument ID", value: transferInstrumentId || "" },
  ];

  const ccy = currency || "USD";

  return (
    <div className={`w-full ${PANEL} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[#1D9E75]"
            aria-hidden
          />
          <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[#0B1222]">
            BALANCE ACCOUNT
          </p>
        </div>
        <span className="shrink-0 rounded bg-[#E1F5EE] py-0.5 px-2.5 text-xs font-medium text-[#1D9E75]">
          Active
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <p className={`text-xs font-medium ${MUTED}`}>Available balance</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-3xl font-medium leading-none tracking-tight text-[#0B1222] tabular-nums sm:text-4xl">
            {formatCurrency(availableMinorUnits, ccy)}
          </p>
          <span className={`text-sm ${MUTED}`}>{ccy}</span>
        </div>
      </div>

      <div className="mt-7 mb-2 grid w-full auto-cols-fr grid-flow-col gap-3">
        <MetricTile label="Balance" value={formatCurrency(balanceMinorUnits, ccy)} />
        <MetricTile label="Pending" value={formatCurrency(pendingMinorUnits, ccy)} />
        <MetricTile
          label="Cards issued"
          value={`${cardsIssued}/${cardsCapacity}`}
        />
      </div>

      <div className={`mt-7 border-t ${BORDER} pt-4`}>
        <div className="space-y-2">
          {ids.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <p className={`text-xs ${MUTED}`}>{item.label}</p>
              <span className="max-w-[55%] select-all break-all text-right font-mono text-[11px] text-[#5C6B84]">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
