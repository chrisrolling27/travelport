import { adyenPlatformRequest } from "@/lib/adyen";

const BRAND_VARIANT_BY_BRAND = {
  visa: process.env.ADYEN_BRAND_VARIANT_VISA || "visa_credit_s",
  mc: process.env.ADYEN_BRAND_VARIANT_MASTERCARD || "mc_credit_mco",
};
const HARDCODED_CARDHOLDER_NAME = "Chris Rolling";
const MAX_PAYMENT_INSTRUMENTS = 4;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const balanceAccountId = searchParams.get("balanceAccountId");
    if (!balanceAccountId) {
      return Response.json({ error: "balanceAccountId is required." }, { status: 400 });
    }

    const data = await adyenPlatformRequest(
      `/balanceAccounts/${balanceAccountId}/paymentInstruments`,
      "GET"
    );
    const cardPaymentInstruments = (data?.paymentInstruments || []).filter(
      (instrument) => (instrument?.type || "").toLowerCase() === "card"
    );
    return Response.json({
      ...data,
      paymentInstruments: cardPaymentInstruments.slice(0, MAX_PAYMENT_INSTRUMENTS),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to list cards.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { balanceAccountId, brand, reference } = await request.json();
    if (!balanceAccountId || !brand) {
      return Response.json(
        { error: "balanceAccountId and brand are required." },
        { status: 400 }
      );
    }

    const normalizedBrand = String(brand || "").toLowerCase() === "visa" ? "visa" : "mc";
    const brandVariant = BRAND_VARIANT_BY_BRAND[normalizedBrand];
    if (!brandVariant) {
      return Response.json(
        { error: `Missing brand variant for ${normalizedBrand} in environment.` },
        { status: 500 }
      );
    }

    const existingPaymentInstruments = await adyenPlatformRequest(
      `/balanceAccounts/${balanceAccountId}/paymentInstruments`,
      "GET"
    );
    const existingCards = (existingPaymentInstruments?.paymentInstruments || []).filter(
      (instrument) => (instrument?.type || "").toLowerCase() === "card"
    );
    if (existingCards.length >= MAX_PAYMENT_INSTRUMENTS) {
      return Response.json(
        { error: `You can only create up to ${MAX_PAYMENT_INSTRUMENTS} payment instruments.` },
        { status: 400 }
      );
    }

    const normalizedReference = String(reference || "").trim().slice(0, 20);
    const nextCardNumber = existingCards.length + 1;
    const description = `card_${nextCardNumber}`;
    const payload = {
      type: "card",
      balanceAccountId,
      card: {
        brand: normalizedBrand,
        brandVariant,
        cardholderName: HARDCODED_CARDHOLDER_NAME,
        formFactor: "virtual",
      },
      issuingCountryCode: "US",
      description,
    };
    if (normalizedReference) {
      payload.reference = normalizedReference;
    }

    const data = await adyenPlatformRequest("/paymentInstruments", "POST", payload);

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create card.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

