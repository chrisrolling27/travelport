// In-memory scoreboard store, keyed by accountHolderId. Persists for the
// dev server's lifetime; resets on process restart. Good enough for a demo —
// the Adyen API doesn't expose a per-AH transaction tag we can rely on across
// the two distinct merchant accounts (TravelportECOM acquires, SAPTauliaECOM
// processes the Drop-in card spend), so we record what we already know
// locally and reconcile in the Scoreboard tab.

const PLATFORM_COMMISSION_BPS = 100; // 1% commission on sale
const INTERCHANGE_BPS = 200; // 2% interchange assumed on card spend
const INTERCHANGE_PLATFORM_SHARE_BPS = 100; // platform keeps 1%, user keeps 1%

const scoreboardByAccountHolder = new Map();

function ensureBucket(accountHolderId) {
  if (!scoreboardByAccountHolder.has(accountHolderId)) {
    scoreboardByAccountHolder.set(accountHolderId, { sales: [], purchases: [] });
  }
  return scoreboardByAccountHolder.get(accountHolderId);
}

export function recordSale(accountHolderId, sale) {
  if (!accountHolderId) return null;
  const bucket = ensureBucket(accountHolderId);
  const entry = {
    id: `${sale.reference || sale.pspReference}-${Date.now()}`,
    type: "sale",
    reference: sale.reference || "",
    pspReference: sale.pspReference || "",
    amountMinor: Number(sale.amountMinor) || 0,
    currency: sale.currency || "USD",
    flight: sale.flight || null,
    timestamp: new Date().toISOString(),
    matchedPurchaseId: null,
  };
  bucket.sales.push(entry);
  return entry;
}

export function recordPurchase(accountHolderId, purchase) {
  if (!accountHolderId) return null;
  const bucket = ensureBucket(accountHolderId);
  const entry = {
    id: `${purchase.reference || purchase.pspReference}-${Date.now()}`,
    type: "purchase",
    reference: purchase.reference || "",
    pspReference: purchase.pspReference || "",
    amountMinor: Number(purchase.amountMinor) || 0,
    currency: purchase.currency || "USD",
    flight: purchase.flight || null,
    timestamp: new Date().toISOString(),
    matchedSaleId: null,
  };

  // Pair with the most recent unmatched sale (FIFO inside a user's bucket).
  const unmatchedSale = [...bucket.sales].reverse().find((s) => !s.matchedPurchaseId);
  if (unmatchedSale) {
    unmatchedSale.matchedPurchaseId = entry.id;
    entry.matchedSaleId = unmatchedSale.id;
  }

  bucket.purchases.push(entry);
  return entry;
}

export function getScoreboard(accountHolderId) {
  const bucket = scoreboardByAccountHolder.get(accountHolderId) || { sales: [], purchases: [] };
  const salesById = new Map(bucket.sales.map((s) => [s.id, s]));
  const purchasesById = new Map(bucket.purchases.map((p) => [p.id, p]));

  const pairs = bucket.sales.map((sale) => {
    const purchase = sale.matchedPurchaseId ? purchasesById.get(sale.matchedPurchaseId) : null;
    const soldMinor = sale.amountMinor;
    const purchasedMinor = purchase?.amountMinor || 0;
    const platformCommissionMinor = Math.round((soldMinor * PLATFORM_COMMISSION_BPS) / 10000);
    const interchangeMinor = purchase ? Math.round((purchasedMinor * INTERCHANGE_BPS) / 10000) : 0;
    const platformInterchangeMinor = purchase
      ? Math.round((purchasedMinor * INTERCHANGE_PLATFORM_SHARE_BPS) / 10000)
      : 0;
    const userInterchangeMinor = interchangeMinor - platformInterchangeMinor;
    // User net = (sold - platform commission) - (purchased - user interchange share)
    const userNetMinor = soldMinor - platformCommissionMinor - purchasedMinor + userInterchangeMinor;
    return {
      sale,
      purchase,
      currency: sale.currency,
      soldMinor,
      purchasedMinor,
      platformCommissionMinor,
      interchangeMinor,
      platformInterchangeMinor,
      userInterchangeMinor,
      userNetMinor,
    };
  });

  // Surface any orphan purchases (Drop-in payments without a matching sale).
  const orphanPurchases = bucket.purchases.filter((p) => !p.matchedSaleId);

  const totals = pairs.reduce(
    (acc, p) => {
      acc.soldMinor += p.soldMinor;
      acc.purchasedMinor += p.purchasedMinor;
      acc.platformCommissionMinor += p.platformCommissionMinor;
      acc.platformInterchangeMinor += p.platformInterchangeMinor;
      acc.userInterchangeMinor += p.userInterchangeMinor;
      acc.userNetMinor += p.userNetMinor;
      return acc;
    },
    {
      soldMinor: 0,
      purchasedMinor: 0,
      platformCommissionMinor: 0,
      platformInterchangeMinor: 0,
      userInterchangeMinor: 0,
      userNetMinor: 0,
    }
  );
  totals.platformTotalMinor = totals.platformCommissionMinor + totals.platformInterchangeMinor;

  return {
    sales: bucket.sales,
    purchases: bucket.purchases,
    pairs,
    orphanPurchases,
    totals,
    constants: {
      platformCommissionBps: PLATFORM_COMMISSION_BPS,
      interchangeBps: INTERCHANGE_BPS,
      interchangePlatformShareBps: INTERCHANGE_PLATFORM_SHARE_BPS,
    },
  };
}
