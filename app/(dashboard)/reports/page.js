"use client";

import { useEffect, useState } from "react";
import AdyenComponentMount from "@/components/AdyenComponentMount";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import { useApiHistory } from "@/context/ApiHistoryContext";

export default function ReportsPage() {
  const { trackedFetch } = useApiHistory();
  const [reportsAccountHolderId, setReportsAccountHolderId] = useState("");
  const [reportsBalanceAccountId, setReportsBalanceAccountId] = useState("");
  const [error, setError] = useState("");
  const [errorHint, setErrorHint] = useState("");

  useEffect(() => {
    const loadReportsAccountHolder = async () => {
      try {
        setError("");
        setErrorHint("");
        const accountHolder = await trackedFetch("/api/adyen/reports/account-holder");
        if (!accountHolder?.id) {
          throw new Error("Configured reports account holder was not found.");
        }
        if (!accountHolder?.reportsBalanceAccountId) {
          throw new Error("Configured reports balance account was not found.");
        }
        setReportsAccountHolderId(accountHolder.id);
        setReportsBalanceAccountId(accountHolder.reportsBalanceAccountId);
      } catch (err) {
        setError(err.message);
        setErrorHint(err?.payload?.diagnostics?.hint || "");
      }
    };
    loadReportsAccountHolder();
  }, [trackedFetch]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Reports" subtitle="Access your Payout report" />

      {error ? (
        <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errorHint ? <p className="font-medium">{errorHint}</p> : null}
          <p>{error}</p>
        </div>
      ) : !reportsAccountHolderId || !reportsBalanceAccountId ? (
        <LoadingSkeleton className="h-64 w-full" />
      ) : (
        <section>
          <AdyenComponentMount
            componentName="ReportsOverview"
            accountHolderId={reportsAccountHolderId}
            balanceAccountId={reportsBalanceAccountId}
            roles={["Reports Overview Component: View"]}
          />
        </section>
      )}
    </div>
  );
}

