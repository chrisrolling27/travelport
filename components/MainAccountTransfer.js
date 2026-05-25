"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_AMOUNT = "500.00";

const TOPUP_OK_RESULT_CODES = new Set(["Authorised", "Pending", "Received"]);

export default function MainAccountTransfer({ onTransferComplete, onSuccess, onError }) {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const sendToTransferInstrumentCapability = user?.capabilities?.sendToTransferInstrument || {};
  const receiveFromTransferInstrumentCapability = user?.capabilities?.receiveFromTransferInstrument || {};
  const canSendToTransferInstrument = sendToTransferInstrumentCapability?.allowed === true;
  const canReceiveFromTransferInstrument = receiveFromTransferInstrumentCapability?.allowed === true;
  const availableBalanceAccountIds = useMemo(() => {
    const base = Array.isArray(user?.balanceAccounts) ? user.balanceAccounts.map((item) => item?.id) : [];
    const all = [...base, user?.balanceAccountId];
    return [...new Set(all.filter(Boolean))];
  }, [user?.balanceAccountId, user?.balanceAccounts]);
  const availableTransferInstrumentIds = useMemo(() => {
    const sendTransferInstruments = sendToTransferInstrumentCapability?.transferInstruments || [];
    const receiveTransferInstruments = receiveFromTransferInstrumentCapability?.transferInstruments || [];
    const all = [...sendTransferInstruments, ...receiveTransferInstruments];
    return [
      ...new Set(
        all
          .filter((instrument) => instrument?.id && instrument?.allowed !== false)
          .map((instrument) => instrument.id)
      ),
    ];
  }, [
    receiveFromTransferInstrumentCapability?.transferInstruments,
    sendToTransferInstrumentCapability?.transferInstruments,
  ]);
  const endpointOptions = useMemo(() => {
    const balanceAccountId = availableBalanceAccountIds[0];
    const transferInstrumentId = availableTransferInstrumentIds[0];
    const options = [];
    if (balanceAccountId) {
      options.push({
        key: `balanceAccount:${balanceAccountId}`,
        type: "balanceAccount",
        id: balanceAccountId,
        label: `Balance Account ${balanceAccountId}`,
      });
    }
    if (transferInstrumentId) {
      options.push({
        key: `transferInstrument:${transferInstrumentId}`,
        type: "transferInstrument",
        id: transferInstrumentId,
        label: `Transfer Instrument ${transferInstrumentId}`,
      });
    }
    return options;
  }, [availableBalanceAccountIds, availableTransferInstrumentIds]);
  const endpointByKey = useMemo(
    () => Object.fromEntries(endpointOptions.map((option) => [option.key, option])),
    [endpointOptions]
  );
  const sourceOptions = endpointOptions;
  const destinationOptions = endpointOptions;
  const [form, setForm] = useState({
    sourceKey: "",
    recipientKey: "",
    amount: DEFAULT_AMOUNT,
  });
  const amountNumber = Number.parseFloat(String(form.amount));
  const amountMinorRounded = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : NaN;
  const hasAmountInRange =
    Number.isFinite(amountMinorRounded) && amountMinorRounded >= 100 && amountMinorRounded <= 999_999;
  const canSubmit =
    !isSubmitting &&
    Boolean(form.sourceKey) &&
    Boolean(form.recipientKey) &&
    form.sourceKey !== form.recipientKey &&
    hasAmountInRange;

  const sourceForUi = form.sourceKey ? endpointByKey[form.sourceKey] : null;
  const recipientForUi = form.recipientKey ? endpointByKey[form.recipientKey] : null;
  const isTopUpDirection =
    sourceForUi?.type === "transferInstrument" && recipientForUi?.type === "balanceAccount";

  useEffect(() => {
    const defaultSource =
      sourceOptions.find((option) => option.type === "transferInstrument")?.key ||
      sourceOptions[0]?.key ||
      "";
    const defaultRecipient =
      destinationOptions.find((option) => option.type === "balanceAccount")?.key ||
      destinationOptions[0]?.key ||
      "";
    setForm((prev) => ({
      ...prev,
      sourceKey: sourceOptions.some((option) => option.key === prev.sourceKey) ? prev.sourceKey : defaultSource,
      recipientKey: destinationOptions.some((option) => option.key === prev.recipientKey)
        ? prev.recipientKey
        : defaultRecipient,
    }));
  }, [destinationOptions, sourceOptions]);

  const submitTransfer = async (event) => {
    event.preventDefault();

    if (!hasAmountInRange) {
      const message = "Amount must be between 1 and 9999.99.";
      setError(message);
      if (onError) onError(message);
      return;
    }

    if (!form.sourceKey || !form.recipientKey) {
      const message = "Source and destination are required.";
      setError(message);
      if (onError) onError(message);
      return;
    }

    if (form.sourceKey === form.recipientKey) {
      const message = "Source and recipient must be different.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    const sourceEndpoint = endpointByKey[form.sourceKey];
    const recipientEndpoint = endpointByKey[form.recipientKey];
    if (!sourceEndpoint || !recipientEndpoint) {
      const message = "Selected source or destination is unavailable.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    const isBalanceToTransferInstrument =
      sourceEndpoint.type === "balanceAccount" && recipientEndpoint.type === "transferInstrument";
    const isTransferInstrumentToBalance =
      sourceEndpoint.type === "transferInstrument" && recipientEndpoint.type === "balanceAccount";
    if (isBalanceToTransferInstrument && !canSendToTransferInstrument) {
      const message = "sendToTransferInstrument capability is required for Balance Account to Transfer Instrument transfers.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    if (isTransferInstrumentToBalance && !canReceiveFromTransferInstrument) {
      const message =
        "receiveFromTransferInstrument capability is required for Transfer Instrument to Balance Account transfers.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    const amountMinor = amountMinorRounded;

    try {
      setIsSubmitting(true);
      setError("");

      if (isBalanceToTransferInstrument) {
        await trackedFetch("/api/adyen/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountValue: amountMinor,
            balanceAccountId: sourceEndpoint.id,
            transferInstrumentId: recipientEndpoint.id,
          }),
        });
      } else if (isTransferInstrumentToBalance) {
        const returnUrl =
          typeof window !== "undefined" ? `${window.location.origin}/home` : "";
        const topUpResult = await trackedFetch("/api/adyen/checkout/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountValue: amountMinor,
            balanceAccountId: recipientEndpoint.id,
            transferInstrumentId: sourceEndpoint.id,
            returnUrl,
          }),
        });
        const redirectUrl = topUpResult?.action?.url;
        if (typeof redirectUrl === "string" && redirectUrl.length > 0) {
          window.location.assign(redirectUrl);
          return;
        }
        const resultCode = topUpResult?.resultCode;
        if (resultCode && !TOPUP_OK_RESULT_CODES.has(resultCode)) {
          const message = topUpResult?.refusalReason || `Top-up was not successful (${resultCode}).`;
          setError(message);
          if (onError) onError(message);
          return;
        }
      } else {
        const message = "Unsupported transfer direction.";
        setError(message);
        if (onError) onError(message);
        return;
      }

      if (onTransferComplete) await onTransferComplete();
      setError("");
      setForm((prev) => ({ ...prev, amount: DEFAULT_AMOUNT }));
      if (onSuccess) {
        const summary = isTransferInstrumentToBalance ? `Top Up credited ${formatCurrency(amountMinor)}!` : "Transfer successful";
        onSuccess(summary);
      }
    } catch (err) {
      const message = err.message || "Transfer failed.";
      setError(message);
      if (onError) onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="ca-section-title">Transfer Funds</h2>

      <form onSubmit={submitTransfer} className="grid gap-2">
        <label className="text-xs font-medium text-[#3B4556]">Source</label>
        <select
          className="ca-input"
          value={form.sourceKey}
          onChange={(event) => setForm((prev) => ({ ...prev, sourceKey: event.target.value }))}
          disabled={isSubmitting || sourceOptions.length === 0}
        >
          {sourceOptions.length === 0 ? (
            <option value="">No source available</option>
          ) : null}
          {sourceOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="text-xs font-medium text-[#3B4556]">Destination</label>
        <select
          className="ca-input"
          value={form.recipientKey}
          onChange={(event) => setForm((prev) => ({ ...prev, recipientKey: event.target.value }))}
          disabled={isSubmitting || destinationOptions.length === 0}
        >
          {destinationOptions.length === 0 ? (
            <option value="">No destination available</option>
          ) : null}
          {destinationOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="mt-5 flex min-h-[42px] overflow-hidden rounded-lg border border-[#D8DFEA] bg-white transition focus-within:border-[#2575FC] focus-within:ring-2 focus-within:ring-[#2575FC]/15">
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
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-[#0B0B0B] outline-none"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            disabled={isSubmitting}
            placeholder="0.00"
            inputMode="decimal"
            aria-label="Amount in US dollars"
          />
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-lg border border-transparent bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5 hover:from-[#16A34A] hover:via-[#15803D] hover:to-[#166534] hover:shadow-[0_14px_30px_rgba(21,128,61,0.33)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!canSubmit}
        >
          {isSubmitting
            ? isTopUpDirection
              ? "Topping up..."
              : "Transferring..."
            : isTopUpDirection
              ? "Top Up"
              : "Transfer"}
        </button>
      </form>
    </div>
  );
}
