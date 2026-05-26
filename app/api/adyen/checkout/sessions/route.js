import { randomUUID } from "crypto";
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

    // Hard-coded simple session creation — no store, no splits, no balance accounts.
    // Drop-in is a standalone "spend your card" demo and intentionally does not
    // depend on the user's provisioned store. (Mirrors the cardportal setup.)
    const data = await adyenCheckoutRequest("/sessions", "POST", {
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: {
        value: amount,
        currency: currency || "USD",
      },
      reference: reference || `virtual card payment ${randomUUID()}`,
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

