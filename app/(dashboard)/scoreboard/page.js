"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { formatCurrency, formatDate } from "@/lib/utils";

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "booked" || s === "authorised" || s === "received") return "text-[#058B3C]";
  if (s === "pending" || s === "reserved") return "text-[#B7791F]";
  if (s === "failed" || s === "refused" || s === "cancelled" || s === "returned") return "text-[#C0392B]";
  return "text-travelport.ink";
}

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

export default function ScoreboardPage() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const balanceAccountId = user?.balanceAccountId || "";

  const initialRange = useMemo(defaultRange, []);
  const [createdSince, setCreatedSince] = useState(initialRange.since);
  const [createdUntil, setCreatedUntil] = useState(initialRange.until);
  const [sortOrder, setSortOrder] = useState("desc");
  const [limit, setLimit] = useState(100);

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!balanceAccountId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        balanceAccountId,
        createdSince: `${createdSince}T00:00:00Z`,
        createdUntil: `${createdUntil}T00:00:00Z`,
        sortOrder,
        limit: String(limit),
      });
      const data = await trackedFetch(`/api/adyen/transfers?${params.toString()}`);
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.transfers) ? data.transfers : [];
      setTransfers(list);
    } catch (err) {
      setError(err?.message || "Failed to load transfers.");
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [balanceAccountId, createdSince, createdUntil, sortOrder, limit, trackedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return transfers.map((t) => {
      const value = t?.amount?.value ?? 0;
      const currency = t?.amount?.currency || "USD";
      const direction = String(t?.direction || "").toLowerCase();
      const signed = direction === "outgoing" ? -Math.abs(value) : value;
      return {
        id: t?.id || "—",
        createdAt: t?.creationDate || t?.bookingDate || "",
        category: t?.category || "—",
        direction: t?.direction || "—",
        status: t?.status || "—",
        reference: t?.reference || t?.referenceForBeneficiary || "—",
        description: t?.description || "—",
        counterparty:
          t?.counterparty?.balanceAccountId ||
          t?.counterparty?.transferInstrumentId ||
          t?.counterparty?.merchant?.name ||
          t?.counterparty?.bankAccount?.accountHolder?.fullName ||
          "—",
        signed,
        currency,
      };
    });
  }, [transfers]);

  const totals = useMemo(() => {
    const sum = rows.reduce(
      (acc, r) => {
        if (r.signed >= 0) acc.in += r.signed;
        else acc.out += Math.abs(r.signed);
        return acc;
      },
      { in: 0, out: 0 }
    );
    return { ...sum, net: sum.in - sum.out, currency: rows[0]?.currency || "USD" };
  }, [rows]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Scoreboard"
        subtitle="Recent transfers on your balance account, from the Adyen Transfers API."
      />

      <section className="ca-panel">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
          <div>
            <label className="ca-label">Created since</label>
            <input
              type="date"
              value={createdSince}
              onChange={(e) => setCreatedSince(e.target.value)}
              className="ca-input"
            />
          </div>
          <div>
            <label className="ca-label">Created until</label>
            <input
              type="date"
              value={createdUntil}
              onChange={(e) => setCreatedUntil(e.target.value)}
              className="ca-input"
            />
          </div>
          <div>
            <label className="ca-label">Sort order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="ca-input"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <div>
            <label className="ca-label">Limit</label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 100)}
              className="ca-input"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={load}
              disabled={!balanceAccountId || loading}
              className="ca-button-primary w-full"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs ca-muted">
          {balanceAccountId ? (
            <>
              Balance account <span className="font-mono">{balanceAccountId}</span>
            </>
          ) : (
            "No balance account on this session."
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="ca-panel">
          <div className="ca-muted text-xs uppercase tracking-wide">Incoming</div>
          <div className="mt-1 text-xl font-semibold text-[#058B3C]">
            {formatCurrency(totals.in, totals.currency)}
          </div>
        </div>
        <div className="ca-panel">
          <div className="ca-muted text-xs uppercase tracking-wide">Outgoing</div>
          <div className="mt-1 text-xl font-semibold text-[#C0392B]">
            {formatCurrency(totals.out, totals.currency)}
          </div>
        </div>
        <div className="ca-panel">
          <div className="ca-muted text-xs uppercase tracking-wide">Net</div>
          <div className="mt-1 text-xl font-semibold">
            {formatCurrency(totals.net, totals.currency)}
          </div>
        </div>
      </section>

      {error ? (
        <section className="ca-panel">
          <p className="text-sm text-[#C0392B]">{error}</p>
        </section>
      ) : null}

      <section className="ca-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ca-table">
            <thead>
              <tr>
                <th className="ca-th">Created</th>
                <th className="ca-th">Category</th>
                <th className="ca-th">Direction</th>
                <th className="ca-th">Status</th>
                <th className="ca-th">Counterparty</th>
                <th className="ca-th">Reference</th>
                <th className="ca-th text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ca-td">
                    <LoadingSkeleton />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ca-td text-center ca-muted">
                    No transfers found for this range.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="ca-td whitespace-nowrap">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                    <td className="ca-td whitespace-nowrap capitalize">{r.category}</td>
                    <td className="ca-td whitespace-nowrap capitalize">{r.direction}</td>
                    <td className={`ca-td whitespace-nowrap font-semibold capitalize ${statusTone(r.status)}`}>
                      {r.status}
                    </td>
                    <td className="ca-td truncate font-mono text-xs" title={r.counterparty}>
                      {r.counterparty}
                    </td>
                    <td className="ca-td truncate" title={r.reference}>
                      {r.reference}
                    </td>
                    <td className="ca-td whitespace-nowrap text-right font-semibold">
                      {formatCurrency(r.signed, r.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
