import {
  hydrateSessionFromAccountHolderId,
  loginOrProvisionSessionByReference,
} from "@/lib/accountHolderSession";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const FAILED_LOGIN_MAX = 5;
const FAILED_LOCK_MS = 15 * 60 * 1000;
const MIN_FORM_FILL_MS = 1200;

const rateStore = new Map();
const failedStore = new Map();

function getIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function consumeRate(ip) {
  const now = Date.now();
  const bucket = rateStore.get(ip) || { count: 0, windowStart: now };
  if (now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  rateStore.set(ip, bucket);
  return bucket.count <= RATE_LIMIT_MAX;
}

function keyFor(ip) {
  return ip;
}

function isLocked(ip) {
  const key = keyFor(ip);
  const data = failedStore.get(key);
  if (!data) return false;
  if (data.lockUntil && data.lockUntil > Date.now()) return true;
  if (data.lockUntil && data.lockUntil <= Date.now()) failedStore.delete(key);
  return false;
}

function recordFailedLogin(ip) {
  const key = keyFor(ip);
  const data = failedStore.get(key) || { attempts: 0, lockUntil: 0 };
  data.attempts += 1;
  if (data.attempts >= FAILED_LOGIN_MAX) {
    data.lockUntil = Date.now() + FAILED_LOCK_MS;
    data.attempts = 0;
  }
  failedStore.set(key, data);
}

function clearFailedLogins(ip) {
  failedStore.delete(keyFor(ip));
}

export async function POST(request) {
  try {
    const ip = getIp(request);
    let payload = {};
    try {
      payload = await request.json();
    } catch (_error) {
      payload = {};
    }
    const { honeypot, formStartedAt, email, accountHolderId } = payload;

    if (honeypot) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    if (formStartedAt && Date.now() - Number(formStartedAt) < MIN_FORM_FILL_MS) {
      return Response.json({ error: "Invalid request timing." }, { status: 400 });
    }

    if (!consumeRate(ip)) {
      return Response.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    if (isLocked(ip)) {
      return Response.json(
        { error: "Login temporarily locked. Try again shortly." },
        { status: 429, headers: { "Retry-After": "300" } }
      );
    }

    let session = null;

    const normalizedAccountHolderId = String(accountHolderId || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (normalizedAccountHolderId && !normalizedEmail) {
      // Restore path: AuthContext rehydrate with just the AH id (no email typed).
      session = await hydrateSessionFromAccountHolderId(normalizedAccountHolderId);
    } else if (normalizedAccountHolderId && normalizedEmail) {
      // Fast path from the login form's pre-resolve. Verify the pre-resolved
      // AH actually belongs to the typed email before trusting it; otherwise
      // fall back to the normal email-based lookup.
      try {
        const candidate = await hydrateSessionFromAccountHolderId(normalizedAccountHolderId);
        if (String(candidate?.email || "").toLowerCase() === normalizedEmail) {
          session = candidate;
        } else {
          session = await loginOrProvisionSessionByReference(normalizedEmail);
        }
      } catch (_error) {
        session = await loginOrProvisionSessionByReference(normalizedEmail);
      }
    } else if (normalizedEmail) {
      // Match existing account holder by reference/description, or provision LE → AH → balance account.
      session = await loginOrProvisionSessionByReference(normalizedEmail);
    } else {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    clearFailedLogins(ip);
    return Response.json(session);
  } catch (error) {
    recordFailedLogin(getIp(request));
    const isAuthError = error.status === 401 || error.status === 403;
    return Response.json(
      {
        error: isAuthError
          ? "Adyen authentication failed. Verify ADYEN_PLATFORM_API_KEY in .env (escape any $ as \\$)."
          : error.message || "Login failed.",
        details: error.response || null,
      },
      { status: error.status || 500 }
    );
  }
}

