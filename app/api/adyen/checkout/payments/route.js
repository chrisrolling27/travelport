import { adyenCheckoutRequest } from "@/lib/adyen";

const CUSTOM_ROUTING_FLAG = "adyenIssuedTestCard";

function toClientSafePaymentResponse(payload) {
  if (!payload || typeof payload !== "object") return {};
  return {
    action: payload.action,
    order: payload.order,
    resultCode: payload.resultCode,
  };
}

export async function POST(request) {
  try {
    const {
      amount,
      currency,
      reference,
      stateData,
      additionalData,
      paymentMethod,
      browserInfo,
      origin,
      returnUrl,
    } = await request.json();
    const amountValue = Number(amount);
    const currencyCode = currency || "USD";
    const resolvedStateData = stateData && typeof stateData === "object" ? stateData : {};
    const resolvedPaymentMethod = resolvedStateData.paymentMethod || paymentMethod || null;
    const resolvedBrowserInfo = resolvedStateData.browserInfo || browserInfo || undefined;
    const resolvedAdditionalData =
      additionalData && typeof additionalData === "object"
        ? additionalData
        : resolvedStateData.additionalData && typeof resolvedStateData.additionalData === "object"
          ? resolvedStateData.additionalData
          : {};
    const resolvedOrigin = origin || resolvedStateData.origin || "";
    const resolvedReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout`;

    if (!resolvedPaymentMethod) {
      return Response.json({ error: "paymentMethod is required." }, { status: 400 });
    }

    if (!amount || amountValue <= 0) {
      return Response.json({ error: "amount must be greater than 0." }, { status: 400 });
    }

    const payload = {
      ...resolvedStateData,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      countryCode: "US",
      amount: {
        value: amountValue,
        currency: currencyCode,
      },
      reference,
      paymentMethod: resolvedPaymentMethod,
      browserInfo: resolvedBrowserInfo,
      channel: "Web",
      shopperInteraction: "Ecommerce",
      shopperReference: "demo-shopper",
      origin: resolvedOrigin,
      returnUrl: resolvedReturnUrl,
      additionalData: {
        ...resolvedAdditionalData,
        customRoutingFlag: CUSTOM_ROUTING_FLAG,
      },
    };

    const data = await adyenCheckoutRequest("/payments", "POST", payload);
    const safeData = toClientSafePaymentResponse(data);

    return Response.json(safeData);
  } catch (error) {
    return Response.json({ error: error.message || "Payment failed" }, { status: error.status || 500 });
  }
}

