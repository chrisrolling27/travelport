import { adyenTransfersRequest } from "@/lib/adyen";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const passThrough = ["accountHolderId", "balanceAccountId", "paymentInstrumentId", "createdSince", "createdUntil", "sortOrder", "limit", "cursor"];
    const params = new URLSearchParams();
    for (const key of passThrough) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await adyenTransfersRequest(`/transfers${query}`, "GET");
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch transfers.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { amountValue, amount, balanceAccountId, transferInstrumentId } = await request.json();
    const amountMinor = Number.isFinite(Number(amountValue))
      ? Number(amountValue)
      : Number.isFinite(Number(amount))
        ? Math.round(Number(amount) * 100)
        : NaN;

    if (!Number.isFinite(amountMinor) || amountMinor < 100 || amountMinor > 999999) {
      return Response.json({ error: "amount must be between 1 and 9999.99." }, { status: 400 });
    }
    if (!String(balanceAccountId || "").trim()) {
      return Response.json({ error: "balanceAccountId is required." }, { status: 400 });
    }
    if (!String(transferInstrumentId || "").trim()) {
      return Response.json({ error: "transferInstrumentId is required." }, { status: 400 });
    }

    const transferPayload = {
      amount: { currency: "USD", value: Math.round(amountMinor) },
      counterparty: { transferInstrumentId: String(transferInstrumentId).trim() },
      balanceAccountId: String(balanceAccountId).trim(),
      category: "bank",
      priority: "regular",
      description: "ACH one time payout transfer to TI",
    };

    const data = await adyenTransfersRequest("/transfers", "POST", transferPayload);

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create transfer.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

