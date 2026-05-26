const ADYEN_BASE_URL = "https://balanceplatform-api-test.adyen.com/bcl/v2";
const ADYEN_LEM_URL = "https://kyc-test.adyen.com/lem/v3";
const ADYEN_LEM_V4_URL = "https://kyc-test.adyen.com/lem/v4";
const ADYEN_CHECKOUT_URL = "https://checkout-test.adyen.com/v71";
const ADYEN_TRANSFERS_URL = "https://balanceplatform-api-test.adyen.com/btl/v4";
const ADYEN_SESSION_URL = "https://test.adyen.com/authe/api/v1";
const ADYEN_MANAGEMENT_URL = "https://management-test.adyen.com/v3";

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractAdyenErrorMessage(data, status, statusText) {
  const directMessage =
    asTrimmedString(data?.message) || asTrimmedString(data?.error) || asTrimmedString(data?.detail);
  if (directMessage) return directMessage;

  const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
  if (firstError) {
    const reason =
      asTrimmedString(firstError?.message) ||
      asTrimmedString(firstError?.detail) ||
      asTrimmedString(firstError?.reason);
    const field = asTrimmedString(firstError?.field) || asTrimmedString(firstError?.name);
    if (reason && field) return `${field}: ${reason}`;
    if (reason) return reason;
  }

  const title = asTrimmedString(data?.title);
  if (title) return title;
  return `${status} ${statusText}` || "Adyen API request failed.";
}

async function request(baseUrl, path, method = "GET", body, apiKey) {
  if (!apiKey) {
    const missingKeyError = new Error("Missing API key for Adyen request.");
    missingKeyError.status = 500;
    throw missingKeyError;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    data = { message: responseText || "No response body returned." };
  }

  if (!response.ok) {
    const errorMessage = extractAdyenErrorMessage(data, response.status, response.statusText);
    const error = new Error(errorMessage);
    error.status = response.status;
    error.response = data;
    throw error;
  }

  return data;
}

export async function adyenPlatformRequest(path, method = "GET", body) {
  return request(
    ADYEN_BASE_URL,
    path,
    method,
    body,
    process.env.ADYEN_PLATFORM_API_KEY
  );
}

export async function adyenLemRequest(path, method = "GET", body) {
  return request(
    ADYEN_LEM_URL,
    path,
    method,
    body,
    process.env.ADYEN_PLATFORM_API_KEY
  );
}

export async function adyenLemV4Request(path, method = "GET", body) {
  return request(
    ADYEN_LEM_V4_URL,
    path,
    method,
    body,
    process.env.ADYEN_PLATFORM_API_KEY
  );
}

export async function adyenCheckoutRequest(path, method = "GET", body) {
  return request(
    ADYEN_CHECKOUT_URL,
    path,
    method,
    body,
    process.env.ADYEN_PAYMENTS_API_KEY
  );
}

export async function adyenTransfersRequest(path, method = "GET", body) {
  return request(
    ADYEN_TRANSFERS_URL,
    path,
    method,
    body,
    process.env.ADYEN_PLATFORM_API_KEY
  );
}

export async function adyenSessionRequest(path, method = "GET", body) {
  return request(
    ADYEN_SESSION_URL,
    path,
    method,
    body,
    process.env.ADYEN_PLATFORM_API_KEY
  );
}

export async function adyenManagementRequest(path, method = "GET", body) {
  return request(
    ADYEN_MANAGEMENT_URL,
    path,
    method,
    body,
    process.env.ADYEN_PAYMENTS_API_KEY
  );
}

