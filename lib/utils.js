export function formatCurrency(minorValue = 0, currency = "USD") {
  const major = Number(minorValue || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(major);
}

export function formatDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function formatTime(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function generateOrderReference() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let sku = "";
  for (let i = 0; i < 8; i++) sku += chars[Math.floor(Math.random() * chars.length)];
  return sku;
}

function safeQueryParam(url, key) {
  try {
    return new URL(url, "http://localhost").searchParams.get(key);
  } catch {
    return null;
  }
}

export function resolveEndpointPlaceholders(endpoint = "", responseBody = null, requestBody = null) {
  if (!endpoint || !endpoint.includes("{")) return endpoint;
  const r = responseBody || {};
  const q = requestBody || {};

  const substitutions = [
    [
      "{accountHolderId}",
      endpoint.includes("/accountHolders/{accountHolderId}/balanceAccounts")
        ? q.accountHolderId || r.accountHolderId || (r.id && /^AH/i.test(r.id) ? r.id : "")
        : r.accountHolderId || (r.id && /^AH/i.test(r.id) ? r.id : "") || q.accountHolderId,
    ],
    [
      "{balanceAccountId}",
      q.balanceAccountId ||
        r.balanceAccountId ||
        (r.id && /^BA/i.test(r.id) ? r.id : ""),
    ],
    [
      "{legalEntityId}",
      q.legalEntityId ||
        r.legalEntityId ||
        (r.id && /^LE/i.test(r.id) ? r.id : ""),
    ],
    [
      "{paymentInstrumentId}",
      q.paymentInstrumentId ||
        q.id ||
        (r.id && /^PI/i.test(r.id) ? r.id : ""),
    ],
  ];

  let resolved = endpoint;
  for (const [placeholder, value] of substitutions) {
    const v = String(value || "").trim();
    if (v) resolved = resolved.split(placeholder).join(v);
  }
  return resolved;
}

export function endpointFromProxy(url = "", method = "GET", requestBody = null) {
  if (!url.startsWith("/api/")) return url;
  if (url === "/api/login") return "/bcl/v2/accountHolders/{accountHolderId}";
  const clean = url.replace("/api/adyen", "");

  if (clean.startsWith("/checkout/sessions")) return "/v71/sessions";
  if (clean.startsWith("/checkout/payment-methods")) return "/v71/paymentMethods";
  if (clean.startsWith("/checkout/payments/details")) return "/v71/payments/details";
  if (clean.startsWith("/checkout/payments")) return "/v71/payments";
  if (clean.startsWith("/checkout/topup")) return "/v71/payments";

  if (clean.startsWith("/sessions")) return "/authe/api/v1/sessions";

  if (clean.startsWith("/account-overview")) {
    const balanceAccountId = safeQueryParam(url, "balanceAccountId");
    return `/bcl/v2/balanceAccounts/${balanceAccountId || "{balanceAccountId}"}`;
  }

  if (clean.startsWith("/cards/reveal")) return "/bcl/v2/paymentInstruments/reveal";

  if (clean.startsWith("/cards")) {
    if (method === "GET") {
      const balanceAccountId = safeQueryParam(url, "balanceAccountId");
      return `/bcl/v2/balanceAccounts/${balanceAccountId || "{balanceAccountId}"}/paymentInstruments`;
    }
    if (method === "PATCH") {
      const paymentInstrumentId = requestBody?.id;
      return `/bcl/v2/paymentInstruments/${paymentInstrumentId || "{paymentInstrumentId}"}`;
    }
    return "/bcl/v2/paymentInstruments";
  }

  if (clean.startsWith("/transfers")) return "/btl/v4/transfers";
  if (clean.startsWith("/sweeps")) {
    const balanceAccountId = safeQueryParam(url, "balanceAccountId") || requestBody?.balanceAccountId;
    return `/bcl/v2/balanceAccounts/${balanceAccountId || "{balanceAccountId}"}/sweeps`;
  }
  if (clean.startsWith("/hosted-onboarding")) return "/lem/v4/legalEntities/{legalEntityId}/onboardingLinks";

  if (clean.startsWith("/legal-entity/business-lines")) {
    if (method === "GET") {
      const legalEntityId = safeQueryParam(url, "legalEntityId");
      return `/lem/v3/legalEntities/${legalEntityId || "{legalEntityId}"}/businessLines`;
    }
    return "/lem/v4/businessLines";
  }

  if (clean.startsWith("/legal-entity")) return "/lem/v3/legalEntities";
  if (clean.startsWith("/reports/account-holder")) return "/bcl/v2/accountHolders/{accountHolderId}";
  if (clean.startsWith("/reports/balance-accounts")) return "/bcl/v2/accountHolders/{accountHolderId}/balanceAccounts";

  return clean || url;
}

export function extractDetail(endpoint, response) {
  if (!response) return "—";

  if (response.error || response.errorCode) {
    return `FAILED: ${response.message || response.error || "Unknown error"}`;
  }

  if (endpoint.includes("accountHolders")) {
    if (response.id) return response.id;
    if (response.accountHolderId) return response.accountHolderId;
    if (Array.isArray(response.accountHolders)) return `${response.accountHolders.length} AH result(s)`;
    return "AH lookup";
  }

  if (endpoint.includes("paymentInstruments")) {
    if (endpoint.includes("/reveal")) return "Reveals card details";
    if (response.id) return `PI: ${response.id}, Last4: ${response.card?.lastFour || "—"}`;
    if (response.paymentInstruments) {
      const n = response.paymentInstruments.length;
      return `${n} ${n === 1 ? "card" : "cards"} found`;
    }
    return "Card operation";
  }

  if (endpoint.includes("paymentMethods")) {
    return "Available methods: Visa and Mastercard";
  }

  if (endpoint.includes("/payments") || endpoint.includes("/sessions")) {
    if (response.resultCode) {
      if (response.resultCode === "Authorised") return "Payment successful";
      if (response.resultCode === "Refused") {
        return response.refusalReason ? `Payment refused: ${response.refusalReason}` : "Payment refused";
      }
      if (response.resultCode === "Error") return "Payment error";
      if (response.resultCode === "Cancelled") return "Payment cancelled";
      return `Payment ${response.resultCode}`;
    }
    if (response.pspReference) return `PSP: ${response.pspReference}`;
    if (response.id) return `Session created: ${response.id.slice(0, 12)}...`;
  }

  if (endpoint.includes("legalEntities")) {
    if (response.id) return response.id;
    return "LE operation";
  }

  if (endpoint.includes("grants")) {
    if (Array.isArray(response.data)) return `${response.data.length} grant(s)`;
    if (response.id) return `Grant: ${response.id}`;
    return "Grant operation";
  }

  if (endpoint.includes("sweeps")) {
    if (response.id) return `Sweep: ${response.id}, Type: ${response.type}`;
    if (Array.isArray(response.sweeps)) {
      const n = response.sweeps.length;
      return `${n} ${n === 1 ? "sweep" : "sweeps"}`;
    }
    return "Sweep operation";
  }

  if (endpoint.includes("balanceAccounts")) {
    if (response.id) return response.id;
    if (response.balanceAccounts) return `${response.balanceAccounts.length} BA(s)`;
    return "BA operation";
  }

  if (endpoint.includes("businessLines")) {
    if (response.id) return `BL: ${response.id}`;
    if (Array.isArray(response.businessLines)) return "Get Business Lines for Legal Entity";
    return "Business line operation";
  }

  return JSON.stringify(response).slice(0, 60) + "...";
}

export async function copyText(text) {
  await navigator.clipboard.writeText(String(text || ""));
}

