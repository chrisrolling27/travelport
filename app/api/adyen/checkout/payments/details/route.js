import { adyenDropInCheckoutRequest } from "@/lib/adyen";

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
    const body = await request.json();
    if (!body?.details && !body?.paymentData) {
      return Response.json(
        { error: "details or paymentData payload is required." },
        { status: 400 }
      );
    }

    const data = await adyenDropInCheckoutRequest("/payments/details", "POST", body);
    return Response.json(toClientSafePaymentResponse(data));
  } catch (error) {
    return Response.json(
      { error: error.message || "Payment details call failed" },
      { status: error.status || 500 }
    );
  }
}
