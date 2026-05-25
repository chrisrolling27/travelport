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
      hint: "Account holder exists in env var, but no balance accounts were found for that path.",
      probableCause: "reports_account_holder_or_balance_accounts_not_found",
      reportsAccountHolderId,
    };
  }
  return {
    hint: "Unexpected Adyen response while loading reports balance accounts.",
    probableCause: "unknown",
    reportsAccountHolderId,
  };
}

export async function GET() {
  try {
    const reportsAccountHolderId = String(process.env.REPORTS_ACCOUNTHOLDER_ID || "").trim();
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

    const data = await adyenPlatformRequest(
      `/accountHolders/${encodeURIComponent(reportsAccountHolderId)}/balanceAccounts`,
      "GET"
    );
    return Response.json({ ...data, accountHolderId: reportsAccountHolderId });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Failed to fetch reports balance accounts.",
        details: error.response || null,
        diagnostics: diagnosticsFor(error, process.env.REPORTS_ACCOUNTHOLDER_ID || ""),
      },
      { status: error.status || 500 }
    );
  }
}

