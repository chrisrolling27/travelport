import { randomUUID } from "crypto";
import { adyenCheckoutRequest } from "@/lib/adyen";

const COMMISSION_BPS = 1000; // 10% commission to the liable balance account

const TEST_PAYMENT_METHOD = {
  type: "scheme",
  encryptedCardNumber: "test_4111111111111111",
  encryptedExpiryMonth: "test_03",
  encryptedExpiryYear: "test_2030",
  encryptedSecurityCode: "test_737",
};

function buildSplits({ amountValue, balanceAccountId, liableBalanceAccountId, reference }) {
  const commission = Math.round((amountValue * COMMISSION_BPS) / 10000);
  const sale = amountValue - commission;
  return [
    {
      amount: { value: sale },
      type: "BalanceAccount",
      account: balanceAccountId,
      reference: `${reference}-sale`,
      description: "Flight sale proceeds",
    },
    {
      amount: { value: commission },
      type: "BalanceAccount",
      account: liableBalanceAccountId,
      reference: `${reference}-commission`,
      description: "Platform commission (10%)",
    },
  ];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,
      currency,
      reference,
      storeId,
      balanceAccountId,
      stateData,
      origin,
      returnUrl,
      additionalData: clientAdditionalData,
    } = body;
    const amountValue = Number(amount);
    const currencyCode = currency || "USD";
    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;

    if (!amountValue || amountValue <= 0) {
      return Response.json({ error: "amount must be greater than 0." }, { status: 400 });
    }

    const resolvedReference = reference || `virtual card payment ${randomUUID()}`;
    const computedReturnUrl =
      returnUrl ||
      `${origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout`;

    // Drop-in (advanced flow): stateData.paymentMethod arrives from the client,
    // no splits, no store, no balance account. Simple "spend your card" call.
    if (stateData?.paymentMethod) {
      // Mirrors cardportal's /payments route exactly. Spread state.data first
      // so paymentMethod/browserInfo/billingAddress/riskData arrive intact,
      // then layer server-side fields on top. customRoutingFlag is added LAST
      // inside additionalData so it always wins.
      const payload = {
        ...stateData,
        merchantAccount,
        countryCode: "US",
        amount: { value: amountValue, currency: currencyCode },
        reference: resolvedReference,
        paymentMethod: stateData.paymentMethod,
        browserInfo: stateData.browserInfo,
        channel: "Web",
        shopperInteraction: "Ecommerce",
        shopperReference: "demo-shopper",
        origin: origin || "",
        returnUrl: computedReturnUrl,
        additionalData: {
          ...(clientAdditionalData || {}),
          customRoutingFlag: "adyenIssuedTestCard",
        },
      };
      const data = await adyenCheckoutRequest("/payments", "POST", payload);
      console.log("[dropin] /payments raw response:", JSON.stringify({
        resultCode: data?.resultCode,
        refusalReason: data?.refusalReason,
        action: data?.action ? { type: data.action.type, paymentMethodType: data.action.paymentMethodType } : null,
        pspReference: data?.pspReference,
      }));
      // Return only the fields Drop-in actually consumes; extras can confuse v6.
      return Response.json({
        action: data?.action,
        order: data?.order,
        resultCode: data?.resultCode,
      });
    }

    // Acquire Flight (split-payment flow): keep the existing behavior for the
    // top-of-page button. Server-side test card + splits to the platform's
    // liable balance account.
    const liableBalanceAccountId = process.env.LIABLE_BALANCE_ACCOUNT;
    if (!storeId) {
      return Response.json({ error: "storeId is required." }, { status: 400 });
    }
    if (!balanceAccountId) {
      return Response.json({ error: "balanceAccountId is required." }, { status: 400 });
    }
    if (!liableBalanceAccountId) {
      return Response.json({ error: "LIABLE_BALANCE_ACCOUNT env var is not configured." }, { status: 500 });
    }

    const payload = {
      amount: { value: amountValue, currency: currencyCode },
      store: storeId,
      reference: resolvedReference,
      paymentMethod: TEST_PAYMENT_METHOD,
      shopperInteraction: "Ecommerce",
      returnUrl: computedReturnUrl,
      merchantAccount,
      splits: buildSplits({
        amountValue,
        balanceAccountId,
        liableBalanceAccountId,
        reference: resolvedReference,
      }),
    };

    const data = await adyenCheckoutRequest("/payments", "POST", payload);

    return Response.json({
      resultCode: data?.resultCode,
      pspReference: data?.pspReference,
      refusalReason: data?.refusalReason,
      reference: resolvedReference,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Payment failed", details: error.response },
      { status: error.status || 500 }
    );
  }
}
