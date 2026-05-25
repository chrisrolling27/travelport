"use client";

import { useEffect, useMemo, useState } from "react";
import AdyenComponentMount from "@/components/AdyenComponentMount";
import PageHeader from "@/components/PageHeader";
import Toast, { useToast } from "@/components/Toast";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";

export default function PayoutsPage() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const [sweep, setSweep] = useState(null);
  const [isLoadingSweep, setIsLoadingSweep] = useState(true);
  const [isSubmittingSweep, setIsSubmittingSweep] = useState(false);
  const [isDeletingSweep, setIsDeletingSweep] = useState(false);
  const { toast, clearToast, showError, showSuccess } = useToast();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    scheduleType: "daily",
    amount: "100.00",
  });

  const sendToTransferInstrumentCapability = user?.capabilities?.sendToTransferInstrument || {};
  const availableTransferInstruments = useMemo(
    () =>
      (sendToTransferInstrumentCapability?.transferInstruments || [])
        .filter((instrument) => instrument?.id && instrument?.allowed !== false)
        .map((instrument) => instrument.id),
    [sendToTransferInstrumentCapability?.transferInstruments]
  );
  const selectedTransferInstrumentId = availableTransferInstruments[0] || "";
  const canSweepToTransferInstrument =
    Boolean(sendToTransferInstrumentCapability?.allowed) && availableTransferInstruments.length > 0;
  const hasRequiredSweepIds = Boolean(user?.balanceAccountId) && Boolean(selectedTransferInstrumentId);
  const canCreateSweep = canSweepToTransferInstrument && hasRequiredSweepIds;
  const hasSweep = Boolean(sweep);
  const isFormDisabled = isLoadingSweep || isSubmittingSweep || (!hasSweep && !canCreateSweep);
  const sweepAmount = sweep?.sweepAmount || sweep?.targetAmount || null;
  const sweepId = sweep?.id || "";
  const frequencyLabel = (() => {
    const value = String(sweep?.schedule?.type || "");
    if (!value) return "—";
    return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
  })();
  const targetAmountMajor =
    typeof sweepAmount?.value === "number" ? sweepAmount.value / 100 : null;
  const targetAmountFormatted =
    targetAmountMajor != null
      ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          targetAmountMajor
        )
      : null;

  const loadSweep = async () => {
    if (!user?.balanceAccountId) {
      setSweep(null);
      setIsLoadingSweep(false);
      return;
    }
    try {
      setIsLoadingSweep(true);
      setError("");
      const query = new URLSearchParams({
        accountHolderId: user?.accountHolderId || "",
        balanceAccountId: user.balanceAccountId,
      });
      const data = await trackedFetch(`/api/adyen/sweeps?${query.toString()}`);
      setSweep(data?.sweep || null);
    } catch (err) {
      const message = err.message || "Failed to load sweeps.";
      setError(message);
      showError(message);
    } finally {
      setIsLoadingSweep(false);
    }
  };

  useEffect(() => {
    loadSweep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accountHolderId, user?.balanceAccountId]);

  useEffect(() => {
    if (!sweep) {
      setForm({ scheduleType: "daily", amount: "100.00" });
      return;
    }

    const existingAmountMinor = sweep?.sweepAmount?.value ?? sweep?.targetAmount?.value;
    const existingAmount =
      Number.isFinite(existingAmountMinor) && existingAmountMinor >= 100 && existingAmountMinor <= 999_999
        ? (existingAmountMinor / 100).toFixed(2)
        : "100.00";

    setForm({
      scheduleType: sweep?.schedule?.type || "daily",
      amount: existingAmount,
    });
  }, [sweep]);

  const submitSweep = async (event) => {
    event.preventDefault();

    const amountNumber = Number.parseFloat(String(form.amount));
    const amountMinorRounded = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : NaN;
    if (!Number.isFinite(amountMinorRounded) || amountMinorRounded < 100 || amountMinorRounded > 999_999) {
      const message = "Amount must be between 1 and 9999.99.";
      setError(message);
      showError(message);
      return;
    }
    const amount = amountNumber;

    if (!hasSweep && !canCreateSweep) {
      const message = "Unable to create sweep: missing a balance account or eligible transfer instrument.";
      setError(message);
      showError(message);
      return;
    }

    if (hasSweep && !sweepId) {
      const message = "Unable to update sweep: sweep ID is missing.";
      setError(message);
      showError(message);
      return;
    }

    try {
      setIsSubmittingSweep(true);
      setError("");
      const response = await trackedFetch("/api/adyen/sweeps", {
        method: hasSweep ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderId: hasSweep ? undefined : user.accountHolderId,
          sweepId: hasSweep ? sweepId : undefined,
          balanceAccountId: user?.balanceAccountId,
          transferInstrumentId: selectedTransferInstrumentId || sweep?.counterparty?.transferInstrumentId,
          scheduleType: form.scheduleType,
          amount,
        }),
      });

      showSuccess(hasSweep ? "Sweep updated" : "Sweep created");
      await loadSweep();
    } catch (err) {
      const message = err.message || (hasSweep ? "Failed to update sweep." : "Failed to create sweep.");
      setError(message);
      showError(message);
    } finally {
      setIsSubmittingSweep(false);
    }
  };

  const deleteSweep = async () => {
    if (!sweepId || !user?.balanceAccountId) {
      const message = "Unable to delete sweep: missing sweep or balance account ID.";
      setError(message);
      showError(message);
      return;
    }

    try {
      setIsDeletingSweep(true);
      setError("");
      const query = new URLSearchParams({
        balanceAccountId: user.balanceAccountId,
        sweepId,
      });
      await trackedFetch(`/api/adyen/sweeps?${query.toString()}`, {
        method: "DELETE",
      });
      showSuccess("Sweep deleted.");
      await loadSweep();
    } catch (err) {
      const message = err.message || "Failed to delete sweep.";
      setError(message);
      showError(message);
    } finally {
      setIsDeletingSweep(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Sweeps" subtitle="Configure a scheduled transfer of funds to your Transfer Instrument" />

      <section className="ca-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="ca-section-title">Sweep Configuration</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isLoadingSweep
                ? "bg-[#EDF1F7] text-[#5F6B7A]"
                : hasSweep
                  ? "bg-[#E1F5EE] text-[#1D9E75]"
                  : "bg-green-50 text-green-700"
            }`}
          >
            {isLoadingSweep ? "Loading" : hasSweep ? "Sweep Configured" : "Ready to Configure"}
          </span>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {!isLoadingSweep && !canSweepToTransferInstrument ? (
          <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Sweeps are unavailable: this account holder must have `sendToTransferInstrument` capability and at least one
            eligible transfer instrument. Complete onboarding in Onboarding first.
          </p>
        ) : null}
        {!isLoadingSweep && canSweepToTransferInstrument && !user?.balanceAccountId ? (
          <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Sweeps are unavailable because this user does not have a balance account ID in session yet.
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#EDF1F7] bg-[#FBFCFF] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#0B0B0B]">Current Sweep</h3>
            {isLoadingSweep ? (
              <p className="ca-muted mt-2 text-sm">Loading sweep...</p>
            ) : hasSweep ? (
              <>
                <div className="mt-4 rounded-lg border border-blue-100 bg-white p-4">
                  <p className="ca-muted text-xs">Amount</p>
                  <p
                    className="mt-1 flex items-baseline gap-1.5"
                    aria-label={
                      targetAmountFormatted ? `${targetAmountFormatted} US dollars` : undefined
                    }
                  >
                    {targetAmountFormatted ? (
                      <>
                        <span
                          className="text-3xl font-semibold tracking-tight text-[#0B0B0B]"
                          aria-hidden="true"
                        >
                          $
                        </span>
                        <span className="text-3xl font-semibold tracking-tight text-[#0B0B0B]">
                          {targetAmountFormatted}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="ca-muted mt-3 text-xs">Frequency</p>
                  <p className="mt-1 text-xl font-semibold text-[#1D9E75]">{frequencyLabel}</p>
                </div>
                <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="ca-muted whitespace-nowrap">Sweep ID</dt>
                  <dd className="break-all text-right font-semibold text-[#0B0B0B]">{sweepId || "—"}</dd>
                  <dt className="ca-muted whitespace-nowrap">Balance Account</dt>
                  <dd className="break-all text-right font-medium text-[#0B0B0B]">{user?.balanceAccountId || "—"}</dd>
                  <dt className="ca-muted whitespace-nowrap">Transfer Instrument</dt>
                  <dd className="break-all text-right font-medium text-[#0B0B0B]">
                    {sweep.counterparty?.transferInstrumentId || "—"}
                  </dd>
                  <dt className="ca-muted whitespace-nowrap">Priority</dt>
                  <dd className="text-right font-medium text-[#0B0B0B]">Regular</dd>
                </dl>
              </>
            ) : (
              <p className="ca-muted mt-2 text-sm">No sweep configured yet.</p>
            )}
          </div>

          <form onSubmit={submitSweep} className="rounded-xl border border-[#EDF1F7] bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#0B0B0B]">{hasSweep ? "Edit Sweep" : "Setup Sweep"}</h3>

            <div className="mt-4 grid gap-3">
              <div className="rounded-lg border border-[#EDF1F7] bg-[#FBFCFF] px-3 py-2 text-sm">
                <p className="ca-muted text-xs">Source Balance Account</p>
                <p className="mt-1 font-medium text-[#0B0B0B]">{user?.balanceAccountId || "Not available"}</p>
              </div>
              <div className="rounded-lg border border-[#EDF1F7] bg-[#FBFCFF] px-3 py-2 text-sm">
                <p className="ca-muted text-xs">Destination Transfer Instrument</p>
                <p className="mt-1 font-medium text-[#0B0B0B]">{selectedTransferInstrumentId || "Not available"}</p>
              </div>

              <label className="text-xs font-medium text-[#3B4556]">Schedule</label>
              <select
                value={form.scheduleType}
                onChange={(e) => setForm((s) => ({ ...s, scheduleType: e.target.value }))}
                className="ca-input"
                disabled={isFormDisabled}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>

              <label className="text-xs font-medium text-[#3B4556]">Amount</label>
              <div className="flex min-h-[42px] overflow-hidden rounded-lg border border-[#D8DFEA] bg-white transition focus-within:border-[#2575FC] focus-within:ring-2 focus-within:ring-[#2575FC]/15">
                <span
                  className="flex shrink-0 items-center border-r border-[#D8DFEA] bg-[#FBFCFF] px-3 text-sm font-medium text-[#5C6B84]"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  type="number"
                  min={1}
                  max={9999.99}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-[#0B0B0B] outline-none"
                  placeholder="0.00"
                  disabled={isFormDisabled}
                  aria-label="Sweep amount in US dollars"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" className="ca-button-dark flex-1" disabled={isFormDisabled}>
                {isSubmittingSweep ? "Saving..." : hasSweep ? "Edit Sweep" : "Create Sweep"}
              </button>
              {hasSweep ? (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  onClick={deleteSweep}
                  disabled={isDeletingSweep || isSubmittingSweep}
                >
                  {isDeletingSweep ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
          </form>
        </div>

      </section>

      <section>
        <AdyenComponentMount
          componentName="PayoutsOverview"
          accountHolderId={user.accountHolderId}
          roles={["Payouts Overview Component: View"]}
          fallback={
            <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
              Payouts component could not load. This can happen if payouts are not configured yet.
            </p>
          }
        />
      </section>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}

