import { adyenCheckoutRequest } from "@/lib/adyen";

function resolveBaseUrl(request) {
  const origin = request.headers.get("origin");
  if (origin) return origin.trim().replace(/\/$/, "");
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return String(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request) {
  try {
    const { amount, currency, reference, returnUrl } = await request.json();
    const baseUrl = resolveBaseUrl(request);

    const data = await adyenCheckoutRequest("/sessions", "POST", {
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: {
        value: amount,
        currency: currency || "USD",
      },
      reference,
      returnUrl: returnUrl || `${baseUrl}/checkout`,
      countryCode: "US",
      shopperReference: "demo-shopper",
      channel: "Web",
      additionalData: {
        customRoutingFlag: "adyenIssuedTestCard",
      },
    });

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Session creation failed", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

