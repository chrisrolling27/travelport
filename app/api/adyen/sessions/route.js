import { adyenSessionRequest } from "@/lib/adyen";

function resolveAllowOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin) return origin.trim();
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return String(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
}

function diagnosticsFor(error, body) {
  const status = error?.status || 500;
  const roles = body?.policy?.roles || [];
  const resources = body?.policy?.resources || [];

  if (status === 401 || status === 403) {
    return {
      hint: "Adyen auth failed. Verify ADYEN_PLATFORM_API_KEY and escape any $ as \\$ in .env.",
      probableCause: "invalid_api_credentials",
      roles,
      resources,
    };
  }

  if (status === 422 || status === 400) {
    return {
      hint: "Session payload may be invalid for this component policy.",
      probableCause: "invalid_session_policy_or_origin",
      roles,
      resources,
      allowOrigin: body?.allowOrigin,
    };
  }

  return {
    hint: "Unexpected Adyen response while creating platform session.",
    probableCause: "unknown",
    roles,
    resources,
  };
}

export async function POST(request) {
  let body = null;
  try {
    const { accountHolderId, legalEntityId, roles, product } = await request.json();
    const allowOrigin = resolveAllowOrigin(request);

    body = {
      allowOrigin,
      product: product || "platform",
      policy: {
        resources: [],
        roles: roles || [],
      },
    };

    if (accountHolderId) {
      body.policy.resources.push({
        accountHolderId,
        type: "accountHolder",
      });
    }

    if (legalEntityId) {
      body.policy.resources.push({
        legalEntityId,
        type: "legalEntity",
      });
    }

    if (!body.policy.roles.length) {
      return Response.json(
        {
          error: "No component roles provided for session policy.",
          diagnostics: {
            hint: "Pass at least one role (for example: Reports Overview Component: View).",
            probableCause: "missing_roles",
            allowOrigin,
          },
        },
        { status: 400 }
      );
    }

    const data = await adyenSessionRequest("/sessions", "POST", body);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Session creation failed",
        details: error.response || null,
        diagnostics: diagnosticsFor(error, body),
      },
      { status: error.status || 500 }
    );
  }
}

