"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1);
  const until = new Date(now);
  until.setDate(until.getDate() + 1);
  return { since: toDateInput(since), until: toDateInput(until) };
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "booked" || s === "authorised" || s === "received") return "text-[#058B3C]";
  if (s === "pending" || s === "reserved") return "text-[#B7791F]";
  if (s === "failed" || s === "refused" || s === "cancelled" || s === "returned") return "text-[#C0392B]";
  return "";
}

// Pull the flight code out of any of our reference shapes:
//   AA0517             → AA0517         (Acquire Flight, top-level reference)
//   AA0517-sale        → AA0517         (split to user BA)
//   AA0517-commission  → AA0517         (split to liable BA — won't appear on user BA)
//   AA0517-card-3f2a   → AA0517         (Drop-in card payment)
function classifyByReference(reference, description) {
  const ref = String(reference || "");
  const desc = String(description || "");
  const haystack = `${ref} ${desc}`;
  if (/-sale\b/.test(haystack) || /sale proceeds/i.test(desc)) {
    return { kind: "sale", flight: ref.replace(/-sale.*$/, "") };
  }
  if (/-commission\b/.test(haystack) || /commission/i.test(desc)) {
    return { kind: "commission", flight: ref.replace(/-commission.*$/, "") };
  }
  if (/-card\b/.test(haystack)) {
    return { kind: "card", flight: ref.replace(/-card.*$/, "") };
  }
  // Fallback: a bare flight code (looks like AA0517 / DL1234) is treated as a sale.
  const bareFlight = ref.match(/^[A-Z]{2}\d{2,5}$/);
  if (bareFlight) return { kind: "sale", flight: ref };
  return { kind: "other", flight: "" };
}

export default function ScoreboardPage() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const balanceAccountId = user?.balanceAccountId || "";
  const accountHolderId = user?.accountHolderId || "";

  const initialRange = useMemo(defaultRange, []);
  const [createdSince, setCreatedSince] = useState(initialRange.since);
  const [createdUntil, setCreatedUntil] = useState(initialRange.until);
  const [transfers, setTransfers] = useState([]);
  const [scoreboard, setScoreboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!balanceAccountId || !accountHolderId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        balanceAccountId,
        createdSince: `${createdSince}T00:00:00Z`,
        createdUntil: `${createdUntil}T00:00:00Z`,
        sortOrder: "desc",
        limit: "100",
      });
      const [transfersData, scoreboardData] = await Promise.all([
        trackedFetch(`/api/adyen/transfers?${params.toString()}`),
        trackedFetch(`/api/scoreboard?accountHolderId=${encodeURIComponent(accountHolderId)}`),
      ]);
      const list = Array.isArray(transfersData?.data)
        ? transfersData.data
        : Array.isArray(transfersData?.transfers)
          ? transfersData.transfers
          : [];
      setTransfers(list);
      setScoreboard(scoreboardData);
    } catch (err) {
      setError(err?.message || "Failed to load scoreboard.");
    } finally {
      setLoading(false);
    }
  }, [balanceAccountId, accountHolderId, createdSince, createdUntil, trackedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  // Rows from the live Transfers API.
  const transferRows = useMemo(() => {
    return transfers.map((t) => {
      const value = t?.amount?.value ?? 0;
      const currency = t?.amount?.currency || "USD";
      const direction = String(t?.direction || "").toLowerCase();
      const signed = direction === "outgoing" ? -Math.abs(value) : value;
      const reference = t?.reference || t?.referenceForBeneficiary || "";
      const description = t?.description || "";
      const { kind, flight } = classifyByReference(reference, description);
      return {
        id: t?.id || reference || Math.random().toString(36),
        source: "transfers",
        createdAt: t?.creationDate || t?.bookingDate || "",
        kind,
        flight,
        status: t?.status || "—",
        reference: reference || "—",
        description: description || "",
        signed,
        currency,
      };
    });
  }, [transfers]);

  // Drop-in card spend lives on a different merchant (SAPTauliaECOM) and isn't
  // in the Transfers API for the user's BA, so we splice it in from the local ledger.
  const dropinRows = useMemo(() => {
    const purchases = scoreboard?.purchases || [];
    return purchases.map((p) => {
      const flightFromRef = String(p.reference || "").replace(/-card.*$/, "");
      const flight = p.flight?.flightCode || flightFromRef;
      return {
        id: p.id,
        source: "dropin",
        createdAt: p.timestamp,
        kind: "card",
        flight,
        status: "Authorised",
        reference: p.reference || "—",
        description: p.flight ? `Drop-in payment to ${p.flight.airlineName || "airline"}` : "Drop-in card spend",
        signed: -Math.abs(Number(p.amountMinor) || 0),
        currency: p.currency || "USD",
      };
    });
  }, [scoreboard]);

  const allRows = useMemo(() => {
    return [...transferRows, ...dropinRows].sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [transferRows, dropinRows]);

  // Group everything by flight code and only count matched pairs (sale + card).
  // Pure pair-driven math, run directly off the transactions returned above.
  const totals = useMemo(() => {
    const byFlight = new Map();
    for (const r of allRows) {
      if (!r.flight) continue;
      const g = byFlight.get(r.flight) || { sale: null, card: null, currency: r.currency };
      if (r.kind === "sale" && r.signed > 0 && !g.sale) g.sale = r;
      if (r.kind === "card" && !g.card) g.card = r;
      byFlight.set(r.flight, g);
    }
    const acc = {
      currency: "USD",
      pairCount: 0,
      soldGrossMinor: 0,
      soldNetMinor: 0,
      cardSpendMinor: 0,
      platformCommissionMinor: 0,
      platformInterchangeMinor: 0,
      userInterchangeMinor: 0,
      userNetMinor: 0,
    };
    for (const g of byFlight.values()) {
      if (!g.sale || !g.card) continue;
      acc.currency = g.currency || acc.currency;
      const soldNetMinor = g.sale.signed; // what landed in user BA (post 1% split)
      const soldGrossMinor = Math.round(soldNetMinor / 0.99); // gross billed to traveler
      const platformCommissionMinor = soldGrossMinor - soldNetMinor;
      const cardSpendMinor = Math.abs(g.card.signed);
      const platformInterchangeMinor = Math.round(cardSpendMinor * 0.01);
      const userInterchangeMinor = Math.round(cardSpendMinor * 0.01);
      acc.pairCount += 1;
      acc.soldGrossMinor += soldGrossMinor;
      acc.soldNetMinor += soldNetMinor;
      acc.cardSpendMinor += cardSpendMinor;
      acc.platformCommissionMinor += platformCommissionMinor;
      acc.platformInterchangeMinor += platformInterchangeMinor;
      acc.userInterchangeMinor += userInterchangeMinor;
      acc.userNetMinor += soldNetMinor - cardSpendMinor + userInterchangeMinor;
    }
    return acc;
  }, [allRows]);

  const platformEarningsMinor = totals.platformCommissionMinor + totals.platformInterchangeMinor;
  const hasActivity = allRows.length > 0;
  const currency = totals.currency;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Scoreboard" subtitle="OTA margin and Travelport earnings, computed off the Adyen Transfers feed." />

      <section className="ca-panel">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="ca-label">Created since</label>
            <input type="date" value={createdSince} onChange={(e) => setCreatedSince(e.target.value)} className="ca-input" />
          </div>
          <div>
            <label className="ca-label">Created until</label>
            <input type="date" value={createdUntil} onChange={(e) => setCreatedUntil(e.target.value)} className="ca-input" />
          </div>
          <div className="sm:col-span-2 flex sm:justify-end">
            <button type="button" onClick={load} disabled={!balanceAccountId || loading} className="ca-button h-10 px-5 text-sm">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="ca-panel">
          <p className="text-sm text-red-700">{error}</p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ca-panel">
          <h2 className="ca-section-title">You — the OTA</h2>
          <p className="ca-muted -mt-2 mb-4">
            Sell a ticket, then buy the seat from the airline for less. Keep 1% of the card interchange.
          </p>
          <dl className="space-y-3 text-sm">
            <Row label="Tickets sold (gross)" value={formatCurrency(totals.soldGrossMinor, currency)} />
            <Row label="Platform commission (1% of sales)" value={`-${formatCurrency(totals.platformCommissionMinor, currency)}`} negative />
            <Row label="Paid to airlines (Drop-in)" value={`-${formatCurrency(totals.cardSpendMinor, currency)}`} negative />
            <Row label="Interchange share (1% of card spend)" value={`+${formatCurrency(totals.userInterchangeMinor, currency)}`} positive />
            <div className="border-t border-[#EDF1F7] pt-3">
              <Row
                label="OTA net profit"
                value={formatCurrency(totals.userNetMinor, currency)}
                bold
                positive={totals.userNetMinor >= 0}
                negative={totals.userNetMinor < 0}
              />
            </div>
          </dl>
        </section>

        <section className="ca-panel">
          <h2 className="ca-section-title">Travelport — the platform</h2>
          <p className="ca-muted -mt-2 mb-4">
            Earn 1% on every sale and another 1% on the card interchange when the OTA pays the airline.
          </p>
          <dl className="space-y-3 text-sm">
            <Row label="Tickets sold (gross)" value={formatCurrency(totals.soldGrossMinor, currency)} muted />
            <Row label="Paid to airlines (Drop-in)" value={formatCurrency(totals.cardSpendMinor, currency)} muted />
            <Row label="Platform commission (1% of sales)" value={`+${formatCurrency(totals.platformCommissionMinor, currency)}`} positive />
            <Row label="Interchange share (1% of card spend)" value={`+${formatCurrency(totals.platformInterchangeMinor, currency)}`} positive />
            <div className="border-t border-[#EDF1F7] pt-3">
              <Row
                label="Platform earnings"
                value={formatCurrency(platformEarningsMinor, currency)}
                bold
                positive
              />
            </div>
          </dl>
        </section>
      </div>

      <section className="ca-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ca-section-title !mb-0">Transactions</h2>
          <span className="text-xs text-[#5C6B84]">
            {transferRows.length} from Transfers API · {dropinRows.length} Drop-in card spend
          </span>
        </div>
        {!hasActivity ? (
          <EmptyState
            title="No transactions yet"
            message="Acquire a flight and pay the airline with Drop-in. Sales appear here from the Adyen Transfers API; card spend is pulled from the Drop-in ledger."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ca-table">
              <thead>
                <tr>
                  <th className="ca-th">Created</th>
                  <th className="ca-th">Flow</th>
                  <th className="ca-th">Flight</th>
                  <th className="ca-th">Status</th>
                  <th className="ca-th">Reference</th>
                  <th className="ca-th">Description</th>
                  <th className="ca-th text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((r) => (
                  <tr key={r.id} className="border-t border-[#EDF1F7]">
                    <td className="ca-td whitespace-nowrap">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                    <td className="ca-td whitespace-nowrap">
                      <FlowChip kind={r.kind} source={r.source} />
                    </td>
                    <td className="ca-td whitespace-nowrap font-semibold">{r.flight || "—"}</td>
                    <td className={`ca-td whitespace-nowrap font-medium ${statusTone(r.status)}`}>{r.status}</td>
                    <td className="ca-td truncate font-mono text-xs" title={r.reference}>
                      {r.reference}
                    </td>
                    <td className="ca-td truncate" title={r.description}>
                      {r.description || "—"}
                    </td>
                    <td className={`ca-td whitespace-nowrap text-right font-semibold tabular-nums ${r.signed >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(r.signed, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading && !hasActivity ? <LoadingSkeleton className="h-24 w-full" /> : null}
    </div>
  );
}

function FlowChip({ kind, source }) {
  const map = {
    sale: { label: "Sale", color: "bg-green-100 text-green-800" },
    commission: { label: "Commission", color: "bg-amber-100 text-amber-800" },
    card: { label: "Card spend", color: "bg-blue-100 text-blue-800" },
    other: { label: "Other", color: "bg-slate-100 text-slate-700" },
  };
  const entry = map[kind] || map.other;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entry.color}`}>
      {entry.label}
      {source === "dropin" ? <span className="text-[9px] opacity-70">(local)</span> : null}
    </span>
  );
}

function Row({ label, value, bold, positive, negative, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`${bold ? "font-semibold text-[#2E3D5B]" : muted ? "text-[#5C6B84]" : "text-[#2E3D5B]"}`}>{label}</dt>
      <dd
        className={`tabular-nums ${bold ? "text-lg font-bold" : ""} ${
          positive ? "text-green-700" : negative ? "text-red-700" : muted ? "text-[#5C6B84]" : "text-[#0A1A4F]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
