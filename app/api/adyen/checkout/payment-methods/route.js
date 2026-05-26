import { adyenCheckoutRequest, adyenDropInCheckoutRequest } from "@/lib/adyen";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const useDropIn = searchParams.get("flow") === "dropin";
    const { amount, currency } = await request.json().catch(() => ({}));
    const amountValue = Number(amount) || 1000;
    const currencyCode = currency || "USD";

    const merchantAccount = useDropIn
      ? process.env.DROP_IN_ADYEN_MERCHANT_ACCOUNT
      : process.env.ADYEN_MERCHANT_ACCOUNT;
    const requester = useDropIn ? adyenDropInCheckoutRequest : adyenCheckoutRequest;

    const data = await requester("/paymentMethods", "POST", {
      merchantAccount,
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

