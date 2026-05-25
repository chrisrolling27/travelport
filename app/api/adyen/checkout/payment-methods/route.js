import { adyenCheckoutRequest } from "@/lib/adyen";

export async function POST(request) {
  try {
    const { amount, currency } = await request.json().catch(() => ({}));
    const amountValue = Number(amount) || 1000;
    const currencyCode = currency || "USD";

    const data = await adyenCheckoutRequest("/paymentMethods", "POST", {
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      channel: "Web",
      countryCode: "US",
      allowedPaymentMethods: ["scheme"],
      amount: {
        value: amountValue,
        currency: currencyCode,
      },
    });

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to load payment methods", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

