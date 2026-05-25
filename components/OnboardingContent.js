"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import Toast, { useToast } from "@/components/Toast";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiError";

const ONBOARDING_CAPABILITY_ORDER = [
  "issueCardCommercial",
  "useCardCommercial",
  "receivePayments",
  "receiveFromBalanceAccount",
  "receiveFromPlatformPayments",
  "sendToBalanceAccount",
  "sendToTransferInstrument",
];

const CAPABILITY_LABELS = {
  issueCardCommercial: "Issue card commercial",
  useCardCommercial: "Use card commercial",
  receivePayments: "Receive payments",
  receiveFromBalanceAccount: "Receive funds from balance accounts",
  receiveFromPlatformPayments: "Receive funds from split payments",
  sendToBalanceAccount: "Send funds to balance accounts",
  sendToTransferInstrument: "Send funds to transfer instruments",
};

/** Human-readable labels from Adyen capability `problems` (strings, verificationErrors, or generic objects). */
function labelsFromCapabilityProblems(problems) {
  if (!Array.isArray(problems) || !problems.length) return [];
  const labels = [];
  for (const p of problems) {
    if (p == null) continue;
    if (typeof p === "string") {
      const t = p.trim();
      if (t) labels.push(t);
      continue;
    }
    if (typeof p !== "object") continue;
    const errs = p.verificationErrors;
    if (Array.isArray(errs) && errs.length) {
      for (const e of errs) {
        if (e && typeof e === "object") {
          const msg = typeof e.message === "string" ? e.message.trim() : "";
          const code = e.code != null ? String(e.code) : "";
          const typ = e.type != null ? String(e.type) : "";
          if (msg) labels.push(code ? `${msg} (${code})` : msg);
          else if (typ || code) labels.push([typ, code].filter(Boolean).join(" · "));
        } else if (typeof e === "string" && e.trim()) labels.push(e.trim());
      }
      continue;
    }
    if (typeof p.message === "string" && p.message.trim()) {
      labels.push(p.message.trim());
      continue;
    }
    const typePart = p.type != null ? String(p.type) : "";
    const codePart = p.code != null ? String(p.code) : "";
    if (typePart || codePart) {
      labels.push([typePart, codePart].filter(Boolean).join(" · "));
      continue;
    }
    if (p.entity?.type) {
      const id = p.entity.id ? String(p.entity.id) : "";
      labels.push(id ? `${p.entity.type} (${id})` : String(p.entity.type));
      continue;
    }
    let raw;
    try {
      raw = JSON.stringify(p);
    } catch {
      raw = String(p);
    }
    labels.push(raw);
  }
  const seen = new Set();
  return labels.filter((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CapabilityIssueBadges({ labels }) {
  if (!labels?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {labels.map((label, index) => {
        const display = label.length > 120 ? `${label.slice(0, 117)}…` : label;
        return (
          <span
            key={`${index}-${label.slice(0, 32)}`}
            title={label.length > 48 ? label : undefined}
            className="inline-flex max-w-[min(100%,18rem)] truncate rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-red-800"
          >
            {display}
          </span>
        );
      })}
    </div>
  );
}

export default function OnboardingContent() {
  const { user } = useAuth();
  const { trackedFetch } = useApiHistory();
  const { toast, clearToast, showError } = useToast();
  const [expandedCapabilityName, setExpandedCapabilityName] = useState(null);
  const legalEntityId = user?.legalEntityId || "";

  const capabilities = useMemo(() => {
    const capabilityMap = user?.capabilities || {};
    return ONBOARDING_CAPABILITY_ORDER.filter((name) => capabilityMap[name]).map((name) => {
      const value = capabilityMap[name];
      const problems = value?.problems || [];
      return {
        name,
        allowed: value?.allowed === true ? "Yes" : "No",
        status: value?.allowed ? "allowed" : value?.verificationStatus || "pending",
        problems,
        issueLabels: labelsFromCapabilityProblems(problems),
      };
    });
  }, [user?.capabilities]);

  const launchHostedOnboarding = async () => {
    if (!legalEntityId) {
      showError("Missing legal entity in session data.");
      return;
    }

    try {
      const data = await trackedFetch("/api/adyen/hosted-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalEntityId, accountHolderId: user?.accountHolderId }),
      });
      if (data?.onboardingUrl) {
        window.open(data.onboardingUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("No onboarding URL returned by Adyen.");
      }
    } catch (error) {
      showError(getApiErrorMessage(error) || "Unable to launch hosted onboarding.");
    }
  };

  const email = user?.email || "—";
  const primaryBalanceAccountId = user?.balanceAccountId || "—";
  const accountHolderStatus = user?.accountHolderStatus || "—";
  const isAccountHolderActive = String(accountHolderStatus).toLowerCase() === "active";
  const allCapabilitiesSatisfied = capabilities.length > 0 && capabilities.every((cap) => cap.allowed === "Yes");

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="ca-panel">
        <h2 className="ca-section-title">Account Holder</h2>
        <ul className="space-y-2 text-sm text-[#2E3D5B]">
          <li>
            <span className="font-semibold">Email:</span> <span className="break-all">{email}</span>
          </li>
          <li>
            <span className="font-semibold">Status:</span>{" "}
            <span className={isAccountHolderActive ? "text-green-600" : "text-red-600"}>{accountHolderStatus}</span>
          </li>
          <li>
            <span className="font-semibold">Account Holder:</span>{" "}
            <span className="break-all">{user?.accountHolderId || "—"}</span>
          </li>
          <li>
            <span className="font-semibold">Legal Entity:</span> <span className="break-all">{legalEntityId || "—"}</span>
          </li>
          <li>
            <span className="font-semibold">Balance Account:</span>{" "}
            <span className="break-all">{primaryBalanceAccountId}</span>
          </li>
          <li>
            <span className="font-semibold">Payments Business Line:</span>{" "}
            <span className="break-all">{user?.paymentsBusinessLineId || "—"}</span>
          </li>
          <li>
            <span className="font-semibold">Store:</span>{" "}
            <span className="break-all">
              {user?.storeId || "—"}
              {user?.storeReference ? (
                <span className="text-[#5C6B84]"> (ref: {user.storeReference})</span>
              ) : null}
            </span>
          </li>
        </ul>
      </section>

      <section className="ca-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="ca-section-title">
              {allCapabilitiesSatisfied ? "Hosted Onboarding Complete! ✅" : "Hosted Onboarding"}
            </h2>
            {!allCapabilitiesSatisfied ? (
              <p className="mt-2 max-w-2xl text-sm text-[#5C6B84]">
                Open Hosted Onboarding to submit verification details, add transfer instruments, and accept terms and
                conditions to enable capabilities.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={launchHostedOnboarding}
            className="ca-button-dark h-10 w-full px-5 md:w-auto"
          >
            {allCapabilitiesSatisfied ? "Reopen Hosted Onboarding" : "Launch Hosted Onboarding"}
          </button>
        </div>
      </section>

      <section className="ca-panel">
        <h2 className="ca-section-title">Capabilities</h2>
        {capabilities.length === 0 ? (
          <EmptyState title="No capabilities found" message="Login session did not include capability data." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="ca-table">
                <thead>
                  <tr>
                    <th className="ca-th">Function</th>
                    <th className="ca-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {capabilities.map((capability) => {
                    const hasFailureDetail =
                      capability.issueLabels.length > 0 ||
                      (Array.isArray(capability.problems) && capability.problems.length > 0);
                    const isExpanded = expandedCapabilityName === capability.name;
                    const failureCount =
                      capability.issueLabels.length ||
                      (Array.isArray(capability.problems) ? capability.problems.length : 0);
                    const panelId = `onboarding-cap-failures-${capability.name}`;
                    return (
                      <tr key={capability.name} className="border-t border-[#EDF1F7] align-top">
                        <td className="ca-td font-medium">{CAPABILITY_LABELS[capability.name] || capability.name}</td>
                        <td className="ca-td">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={capability.status} />
                              {hasFailureDetail ? (
                                <button
                                  type="button"
                                  id={`${panelId}-trigger`}
                                  className="inline-flex items-center gap-1 rounded-md text-left text-xs font-semibold text-red-600 outline-none ring-red-600 ring-offset-2 focus-visible:ring-2"
                                  aria-expanded={isExpanded}
                                  aria-controls={panelId}
                                  onClick={() =>
                                    setExpandedCapabilityName((current) =>
                                      current === capability.name ? null : capability.name
                                    )
                                  }
                                >
                                  <ChevronRight
                                    className={`h-4 w-4 shrink-0 text-red-600 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                    aria-hidden
                                  />
                                  Failures
                                  {failureCount ? (
                                    <span className="font-normal text-[#5C6B84]">({failureCount})</span>
                                  ) : null}
                                </button>
                              ) : null}
                            </div>
                            {isExpanded && hasFailureDetail ? (
                              <div
                                id={panelId}
                                role="region"
                                aria-labelledby={`${panelId}-trigger`}
                                className="rounded-md border border-[#F0D5D5] bg-red-50/40 p-2.5"
                              >
                                <CapabilityIssueBadges labels={capability.issueLabels} />
                                {capability.problems?.length && !capability.issueLabels.length ? (
                                  <pre className="mt-2 whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-800">
                                    {JSON.stringify(capability.problems, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
