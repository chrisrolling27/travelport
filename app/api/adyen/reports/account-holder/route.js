import { adyenPlatformRequest } from "@/lib/adyen";

function diagnosticsFor(error, reportsAccountHolderId) {
  const status = error?.status || 500;
  if (status === 401 || status === 403) {
    return {
      hint: "Adyen auth failed. Verify ADYEN_PLATFORM_API_KEY and escape any $ as \\$ in .env.",
      probableCause: "invalid_api_credentials",
      reportsAccountHolderId,
    };
  }
  if (status === 404) {
    return {
      hint: "REPORTS_ACCOUNTHOLDER_ID was not found in this Adyen environment.",
      probableCause: "account_holder_not_found",
      reportsAccountHolderId,
    };
  }
  return {
    hint: "Unexpected Adyen response while loading reports account holder.",
    probableCause: "unknown",
    reportsAccountHolderId,
  };
}

export async function GET() {
  try {
    const reportsAccountHolderId = String(process.env.REPORTS_ACCOUNTHOLDER_ID || "").trim();
    const reportsBalanceAccountId = String(process.env.REPORTS_BALANCE_ACCOUNT_ID || "").trim();
    if (!reportsAccountHolderId) {
      return Response.json(
        {
          error: "REPORTS_ACCOUNTHOLDER_ID is not configured.",
          diagnostics: {
            hint: "Set REPORTS_ACCOUNTHOLDER_ID in .env to a valid account holder ID.",
            probableCause: "missing_reports_account_holder_id",
          },
        },
        { status: 500 }
      );
    }
    if (!reportsBalanceAccountId) {
      return Response.json(
        {
          error: "REPORTS_BALANCE_ACCOUNT_ID is not configured.",
          diagnostics: {
            hint: "Set REPORTS_BALANCE_ACCOUNT_ID in .env to a valid balance account ID.",
            probableCause: "missing_reports_balance_account_id",
          },
        },
        { status: 500 }
      );
    }

    const data = await adyenPlatformRequest(
      `/accountHolders/${encodeURIComponent(reportsAccountHolderId)}`,
      "GET"
    );
    return Response.json({
      ...data,
      reportsBalanceAccountId,
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Failed to fetch reports account holder.",
        details: error.response || null,
        diagnostics: diagnosticsFor(error, process.env.REPORTS_ACCOUNTHOLDER_ID || ""),
      },
      { status: error.status || 500 }
    );
  }
}

