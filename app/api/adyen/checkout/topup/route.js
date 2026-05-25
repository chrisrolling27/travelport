import { adyenCheckoutRequest } from "@/lib/adyen";

function toClientSafePaymentResponse(payload) {
  if (!payload || typeof payload !== "object") return {};
  return {
    action: payload.action,
    order: payload.order,
    resultCode: payload.resultCode,
    refusalReason: payload.refusalReason,
  };
}

export async function POST(request) {
  try {
    const { amountValue, amount, balanceAccountId, transferInstrumentId, returnUrl: clientReturnUrl } =
      await request.json();

    const merchantAccount = String(process.env.ADYEN_MERCHANT_ACCOUNT || "").trim();
    if (!merchantAccount) {
      return Response.json({ error: "ADYEN_MERCHANT_ACCOUNT is not configured." }, { status: 500 });
    }

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

    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const returnUrl = String(clientReturnUrl || "").trim() || (baseUrl ? `${baseUrl}/home` : "");
    if (!returnUrl) {
      return Response.json(
        { error: "returnUrl or NEXT_PUBLIC_APP_URL is required for top-up." },
        { status: 400 }
      );
    }

    const value = Math.round(amountMinor);
    const baId = String(balanceAccountId).trim();
    const transferPayload = {
      amount: { currency: "USD", value },
      reference: `ACH Top Up to fund BA ${baId}`,
      paymentMethod: {
        type: "ach",
        transferInstrumentId: String(transferInstrumentId).trim(),
      },
      splits: [
        {
          amount: { value },
          type: "TopUp",
          account: baId,
        },
      ],
      returnUrl,
      merchantAccount,
    };

    console.log("[topup] → POST /v71/payments", JSON.stringify(transferPayload, null, 2));
    try {
      const data = await adyenCheckoutRequest("/payments", "POST", transferPayload);
      console.log("[topup] ← OK", JSON.stringify(data, null, 2));
      return Response.json(toClientSafePaymentResponse(data));
    } catch (adyenError) {
      console.log("[topup] ← ERR", adyenError.status, JSON.stringify(adyenError.response, null, 2));
      throw adyenError;
    }
  } catch (error) {
    return Response.json(
      { error: error.message || "Top-up payment failed.", adyenResponse: error.response || null },
      { status: error.status || 500 }
    );
  }
}
