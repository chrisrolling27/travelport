import { randomUUID } from "crypto";
import {
  adyenLemRequest,
  adyenLemV4Request,
  adyenManagementRequest,
  adyenPlatformRequest,
} from "@/lib/adyen";

const DEFAULT_BALANCE_ACCOUNT_TIME_ZONE = "America/Chicago";
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickPrimaryBalanceAccount(balanceAccounts) {
  if (!Array.isArray(balanceAccounts) || !balanceAccounts.length) return null;
  return (
    balanceAccounts.find((ba) => String(ba?.status || "").toLowerCase() === "active") || balanceAccounts[0]
  );
}

function normalizeReferenceEmail(email) {
  return String(email || "").trim().toLowerCase();
}

const ACCOUNT_HOLDERS_PAGE_SIZE = 100;
const ACCOUNT_HOLDERS_MAX_PAGES = 100;
const LEGAL_ENTITY_REFERENCE_MAX_LEN = 150;

// In-memory cache for email → AccountHolder id lookups. Avoids re-paginating
// the entire balance platform's AH list on every login. Survives the Next.js
// process lifetime; on cold start it's empty and we fall back to pagination.
const accountHolderIdByEmail = new Map();

// Tracks an in-flight warm-cache promise so simultaneous calls share one fetch.
let warmCachePromise = null;
let warmCacheCompletedAt = 0;
const WARM_CACHE_TTL_MS = 60_000;

function legalEntityReferenceFromEmail(normalizedEmail) {
  const email = String(normalizedEmail || "").trim();
  if (!email) return "";
  return email.length > LEGAL_ENTITY_REFERENCE_MAX_LEN
    ? email.slice(0, LEGAL_ENTITY_REFERENCE_MAX_LEN)
    : email;
}

async function createLegalEntityV4ForLoginReference(normalizedEmail, tracker) {
  const reference = legalEntityReferenceFromEmail(normalizedEmail);
  const body = {
    type: "organization",
    organization: {
      legalName: "Exploration Company",
      doingBusinessAs: "The Exploration Company",
      registrationNumber: "",
      type: "privateCompany",
      registeredAddress: {
        city: "Milwaukee",
        country: "US",
        postalCode: "53202",
        stateOrProvince: "WI",
        street: "123 Water Street",
        street2: "13th floor",
      },
      taxInformation: [
        {
          type: "EIN",
          country: "US",
          number: "123456789",
        },
      ],
      support: {
        email: "support@explorationcompany.com",
        phone: {
          number: "+14145551234",
          type: "landline",
        },
      },
    },
  };

  const created = await adyenLemV4Request("/legalEntities", "POST", body);
  if (tracker) {
    tracker.push({
      method: "POST",
      endpoint: "/lem/v4/legalEntities",
      requestBody: body,
      responseBody: created,
      status: 200,
    });
  }

  let provisionedTransferInstrumentId = "";
  const orgLegalEntityId = String(created?.id || "").trim();
  if (orgLegalEntityId) {
    const registrationDocBody = {
      type: "registrationDocument",
      attachments: [
        {
          content: "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBv+f/ub0j6JPRX+E3EmC==",
        },
      ],
      description: "Registration doc for Explorer Company",
      owner: {
        id: orgLegalEntityId,
        type: "legalEntity",
      },
    };
    const registrationDoc = await adyenLemV4Request("/documents", "POST", registrationDocBody);
    if (tracker) {
      tracker.push({
        method: "POST",
        endpoint: "/lem/v4/documents",
        requestBody: registrationDocBody,
        responseBody: registrationDoc,
        status: 200,
      });
    }

    const individualBody = {
      type: "individual",
      individual: {
        name: {
          firstName: "John",
          lastName: "Explorer",
        },
        birthData: {
          dateOfBirth: "1980-01-01",
        },
        email: "john@explorationcompany.com",
        phone: {
          number: "+14145551234",
          type: "mobile",
        },
        residentialAddress: {
          city: "Milwaukee",
          country: "US",
          postalCode: "53202",
          stateOrProvince: "WI",
          street: "456 Water Street",
          street2: "13th floor",
        },
        identificationData: {
          type: "nationalIdNumber",
          number: "123456789",
        },
      },
    };
    const individual = await adyenLemV4Request("/legalEntities", "POST", individualBody);
    if (tracker) {
      tracker.push({
        method: "POST",
        endpoint: "/lem/v4/legalEntities",
        requestBody: individualBody,
        responseBody: individual,
        status: 200,
      });
    }

    const individualLegalEntityId = String(individual?.id || "").trim();
    if (individualLegalEntityId) {
      const associationBody = {
        entityAssociations: [
          { legalEntityId: individualLegalEntityId, type: "signatory", jobTitle: "Manager" },
          { legalEntityId: individualLegalEntityId, type: "uboThroughControl", jobTitle: "Manager" },
          { legalEntityId: individualLegalEntityId, type: "uboThroughOwnership" },
        ],
      };
      const patched = await adyenLemV4Request(
        `/legalEntities/${encodeURIComponent(orgLegalEntityId)}`,
        "PATCH",
        associationBody
      );
      if (tracker) {
        tracker.push({
          method: "PATCH",
          endpoint: `/lem/v4/legalEntities/${orgLegalEntityId}`,
          requestBody: associationBody,
          responseBody: patched,
          status: 200,
        });
      }
    }

    const transferInstrumentBody = {
      legalEntityId: orgLegalEntityId,
      type: "bankAccount",
      bankAccount: {
        accountIdentification: {
          type: "usLocal",
          accountNumber: "0000000000",
          routingNumber: "121202211",
        },
      },
    };
    const transferInstrument = await adyenLemV4Request(
      "/transferInstruments",
      "POST",
      transferInstrumentBody
    );
    if (tracker) {
      tracker.push({
        method: "POST",
        endpoint: "/lem/v4/transferInstruments",
        requestBody: transferInstrumentBody,
        responseBody: transferInstrument,
        status: 200,
      });
    }

    const transferInstrumentId = String(transferInstrument?.id || "").trim();
    provisionedTransferInstrumentId = transferInstrumentId;
    if (transferInstrumentId) {
      const bankStatementBody = {
        type: "bankStatement",
        owner: {
          id: transferInstrumentId,
          type: "bankAccount",
        },
        attachments: [
          {
            content: "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBv+f/ub0j6JPRX+E3EmC==",
            pageName: "bank_statement.pdf",
          },
        ],
      };
      const bankStatementDoc = await adyenLemV4Request("/documents", "POST", bankStatementBody);
      if (tracker) {
        tracker.push({
          method: "POST",
          endpoint: "/lem/v4/documents",
          requestBody: bankStatementBody,
          responseBody: bankStatementDoc,
          status: 200,
        });
      }
    }


    // Best-effort: business lines, store, and payment method setup. None of these are
    // required for the user to log in — failures here must NOT abort LE/AH provisioning,
    // otherwise the user gets stuck (no AH created → next login retries the same failing
    // block forever).
    try {
      const businessLineBodies = [
        {
          service: "paymentProcessing",
          industryCode: "4431A",
          salesChannels: ["eCommerce"],
          legalEntityId: orgLegalEntityId,
          webData: [{ webAddress: "https://adyen.com/" }],
        },
        {
          legalEntityId: orgLegalEntityId,
          service: "issuing",
          industryCode: "45391",
          sourceOfFunds: {
            adyenProcessedFunds: false,
            type: "assetSale",
            dateOfSourceEvent: "2024-12-03",
            description: "Sale of my property at 123 45th St, Chicago, 60613.",
            amount: {
              currency: "USD",
              value: 600000,
            },
          },
          webData: [{ webAddress: "https://adyen.com/" }],
        },
      ];
      let acquiringBusinessLineId = "";
      for (const businessLineBody of businessLineBodies) {
        try {
          const businessLine = await adyenLemV4Request("/businessLines", "POST", businessLineBody);
          if (tracker) {
            tracker.push({
              method: "POST",
              endpoint: "/lem/v4/businessLines",
              requestBody: businessLineBody,
              responseBody: businessLine,
              status: 200,
            });
          }
          if (businessLineBody.service === "paymentProcessing") {
            acquiringBusinessLineId = String(businessLine?.id || "").trim();
          }
        } catch (blError) {
          console.error(
            `[provision] business line (${businessLineBody.service}) failed:`,
            blError?.message || blError
          );
          if (tracker) {
            tracker.push({
              method: "POST",
              endpoint: "/lem/v4/businessLines",
              requestBody: businessLineBody,
              responseBody: blError?.response || { error: blError?.message || String(blError) },
              status: blError?.status || 500,
            });
          }
        }
      }

      const merchantAccount = String(process.env.ADYEN_MERCHANT_ACCOUNT || "").trim();
      if (acquiringBusinessLineId && merchantAccount) {
        try {
          const storeBody = {
            reference: randomUUID(),
            description: "store for stuff",
            shopperStatement: "Flowers.com",
            phoneNumber: "+12623219289",
            businessLineIds: [acquiringBusinessLineId],
            address: {
              country: "US",
              line1: "200 Main Street",
              line2: "Building 5A",
              line3: "Suite 3",
              city: "Springfield",
              stateOrProvince: "NY",
              postalCode: "20250",
            },
          };
          const storePath = `/merchants/${encodeURIComponent(merchantAccount)}/stores`;
          const store = await adyenManagementRequest(storePath, "POST", storeBody);
          if (tracker) {
            tracker.push({
              method: "POST",
              endpoint: `/management/v3${storePath}`,
              requestBody: storeBody,
              responseBody: store,
              status: 200,
            });
          }

          const storeId = String(store?.id || "").trim();
          if (storeId) {
            try {
              const paymentMethodBody = {
                storeIds: [storeId],
                businessLineId: acquiringBusinessLineId,
                type: "visa",
                currencies: ["USD"],
                countries: ["US"],
              };
              const paymentMethodPath = `/merchants/${encodeURIComponent(merchantAccount)}/paymentMethodSettings`;
              const paymentMethod = await adyenManagementRequest(paymentMethodPath, "POST", paymentMethodBody);
              if (tracker) {
                tracker.push({
                  method: "POST",
                  endpoint: `/management/v3${paymentMethodPath}`,
                  requestBody: paymentMethodBody,
                  responseBody: paymentMethod,
                  status: 200,
                });
              }
            } catch (pmError) {
              console.error("[provision] payment method setting failed:", pmError?.message || pmError);
              if (tracker) {
                tracker.push({
                  method: "POST",
                  endpoint: `/management/v3/merchants/${merchantAccount}/paymentMethodSettings`,
                  requestBody: {
                    storeIds: [storeId],
                    businessLineId: acquiringBusinessLineId,
                    type: "visa",
                    currencies: ["USD"],
                    countries: ["US"],
                  },
                  responseBody: pmError?.response || { error: pmError?.message || String(pmError) },
                  status: pmError?.status || 500,
                });
              }
            }
          }
        } catch (storeError) {
          console.error("[provision] store creation failed:", storeError?.message || storeError);
          if (tracker) {
            tracker.push({
              method: "POST",
              endpoint: `/management/v3/merchants/${merchantAccount}/stores`,
              requestBody: { businessLineIds: [acquiringBusinessLineId] },
              responseBody: storeError?.response || { error: storeError?.message || String(storeError) },
              status: storeError?.status || 500,
            });
          }
        }
      }
    } catch (provisionError) {
      console.error("[provision] non-fatal setup error:", provisionError?.message || provisionError);
    }
  }
  const id = String(created?.id || "").trim();
  if (!id) {
    const error = new Error("Legal entity creation succeeded but no legal entity ID was returned.");
    error.status = 502;
    throw error;
  }
  const referenceFromLe = String(created?.reference || "").trim() || reference;
  return { id, reference: referenceFromLe, transferInstrumentId: provisionedTransferInstrumentId };
}

function accountHolderMatchesLoginEmail(accountHolder, normalizedEmail) {
  if (!normalizedEmail) return false;
  const ref = normalizeReferenceEmail(accountHolder?.reference);
  const desc = normalizeReferenceEmail(accountHolder?.description);
  return ref === normalizedEmail || desc === normalizedEmail;
}

async function listAllAccountHoldersForBalancePlatform() {
  const balancePlatform = String(process.env.ADYEN_BALANCE_PLATFORM || "").trim();
  if (!balancePlatform) {
    const error = new Error("ADYEN_BALANCE_PLATFORM is not configured in environment.");
    error.status = 500;
    throw error;
  }

  const all = [];
  let offset = 0;

  for (let page = 0; page < ACCOUNT_HOLDERS_MAX_PAGES; page += 1) {
    const path = `/balancePlatforms/${encodeURIComponent(balancePlatform)}/accountHolders?limit=${ACCOUNT_HOLDERS_PAGE_SIZE}&offset=${offset}`;
    const response = await adyenPlatformRequest(path, "GET");
    const batch = Array.isArray(response?.accountHolders)
      ? response.accountHolders
      : Array.isArray(response?.data)
        ? response.data
        : [];

    all.push(...batch);
    if (batch.length < ACCOUNT_HOLDERS_PAGE_SIZE) break;
    offset += ACCOUNT_HOLDERS_PAGE_SIZE;
  }

  return all;
}

// Prefetches every AccountHolder in the balance platform once and populates
// `accountHolderIdByEmail` for both reference and description matches. Safe to
// call repeatedly — concurrent calls share one in-flight fetch, and we skip
// the work entirely if we ran the warm in the last WARM_CACHE_TTL_MS.
export async function warmAccountHolderCache() {
  if (warmCachePromise) return warmCachePromise;
  if (Date.now() - warmCacheCompletedAt < WARM_CACHE_TTL_MS) {
    return { count: accountHolderIdByEmail.size, cached: true };
  }
  warmCachePromise = (async () => {
    try {
      const accountHolders = await listAllAccountHoldersForBalancePlatform();
      for (const ah of accountHolders) {
        const id = String(ah?.id || "").trim();
        if (!id) continue;
        const ref = normalizeReferenceEmail(ah?.reference);
        const desc = normalizeReferenceEmail(ah?.description);
        if (ref) accountHolderIdByEmail.set(ref, id);
        if (desc && desc !== ref) accountHolderIdByEmail.set(desc, id);
      }
      warmCacheCompletedAt = Date.now();
      return { count: accountHolderIdByEmail.size, cached: false };
    } finally {
      warmCachePromise = null;
    }
  })();
  return warmCachePromise;
}

export async function findAccountHolderByReference(email) {
  const normalizedEmail = normalizeReferenceEmail(email);
  if (!normalizedEmail || !SIMPLE_EMAIL_REGEX.test(normalizedEmail)) return null;

  // Cache fast-path: verify the cached AH still exists and still matches the email.
  const cachedId = accountHolderIdByEmail.get(normalizedEmail);
  if (cachedId) {
    try {
      const ah = await adyenPlatformRequest(`/accountHolders/${encodeURIComponent(cachedId)}`, "GET");
      if (ah?.id && accountHolderMatchesLoginEmail(ah, normalizedEmail)) {
        return ah;
      }
      accountHolderIdByEmail.delete(normalizedEmail);
    } catch (_cacheError) {
      accountHolderIdByEmail.delete(normalizedEmail);
    }
  }

  try {
    const accountHolders = await listAllAccountHoldersForBalancePlatform();
    const match = accountHolders.find((ah) => accountHolderMatchesLoginEmail(ah, normalizedEmail)) || null;
    if (match?.id) {
      accountHolderIdByEmail.set(normalizedEmail, match.id);
    }
    return match;
  } catch (error) {
    const errorMessage = String(error?.message || "").toLowerCase();
    if (error?.status === 404 || errorMessage.includes("not found")) {
      return null;
    }
    throw error;
  }
}

export async function createAccountHolderForReference(email, tracker) {
  const normalizedEmail = normalizeReferenceEmail(email);
  if (!normalizedEmail || !SIMPLE_EMAIL_REGEX.test(normalizedEmail)) {
    const error = new Error("A valid email is required.");
    error.status = 400;
    throw error;
  }

  const balancePlatform = String(process.env.ADYEN_BALANCE_PLATFORM || "").trim();
  if (!balancePlatform) {
    const error = new Error("ADYEN_BALANCE_PLATFORM is not configured in environment.");
    error.status = 500;
    throw error;
  }

  const legalEntity = await createLegalEntityV4ForLoginReference(normalizedEmail, tracker);
  const ahReference = String(legalEntity.reference || "").trim() || normalizedEmail;
  const ahBody = {
    balancePlatform,
    legalEntityId: legalEntity.id,
    reference: ahReference,
    description: ahReference,
  };
  const created = await adyenPlatformRequest("/accountHolders", "POST", ahBody);
  if (tracker) {
    tracker.push({
      method: "POST",
      endpoint: "/bcl/v2/accountHolders",
      requestBody: ahBody,
      responseBody: created,
      status: 200,
    });
  }
  if (created?.id) {
    accountHolderIdByEmail.set(normalizedEmail, created.id);
  }
  return { ...created, _provisionedTransferInstrumentId: legalEntity.transferInstrumentId || "" };
}

export async function loginOrProvisionSessionByReference(email) {
  const existingAccountHolder = await findAccountHolderByReference(email);
  if (existingAccountHolder?.id) {
    return hydrateSessionFromAccountHolderId(existingAccountHolder.id);
  }

  const provisionCalls = [];
  const createdAccountHolder = await createAccountHolderForReference(email, provisionCalls);
  if (!createdAccountHolder?.id) {
    const error = new Error("Account holder creation succeeded but no account holder ID was returned.");
    error.status = 502;
    throw error;
  }

  // Hydration creates a BA when needed and returns a full session payload for memory/localStorage.
  const session = await hydrateSessionFromAccountHolderId(createdAccountHolder.id, provisionCalls);
  const provisionedTi = createdAccountHolder._provisionedTransferInstrumentId || "";
  return {
    ...session,
    transferInstrumentId: session.transferInstrumentId || provisionedTi,
    provisionCalls,
  };
}

export async function hydrateSessionFromAccountHolderId(accountHolderId, tracker) {
  const normalizedAccountHolderId = String(accountHolderId || "").trim();
  if (!normalizedAccountHolderId) {
    const error = new Error("Missing account holder ID.");
    error.status = 400;
    throw error;
  }

  // This is the critical first call: all session data derives from this account holder payload.
  const accountHolder = await adyenPlatformRequest(
    `/accountHolders/${encodeURIComponent(normalizedAccountHolderId)}`,
    "GET"
  );

  const legalEntityId = String(accountHolder?.legalEntityId || "").trim();
  if (!legalEntityId) {
    const error = new Error("Account holder is missing legalEntityId required for onboarding.");
    error.status = 422;
    throw error;
  }

  const fetchBalanceAccounts = async () => {
    const balanceAccountsResponse = await adyenPlatformRequest(
      `/accountHolders/${encodeURIComponent(accountHolder.id)}/balanceAccounts`,
      "GET"
    );
    return balanceAccountsResponse?.balanceAccounts || [];
  };

  let balanceAccounts = await fetchBalanceAccounts();

  // Create only when there are no existing balance accounts for this account holder.
  if (!balanceAccounts.length) {
    const baBody = {
      accountHolderId: accountHolder.id,
      timeZone: DEFAULT_BALANCE_ACCOUNT_TIME_ZONE,
      defaultCurrencyCode: "USD",
      description: `${accountHolder.description || "Business"} Operating Account`,
    };
    const createdBa = await adyenPlatformRequest("/balanceAccounts", "POST", baBody);
    if (tracker) {
      tracker.push({
        method: "POST",
        endpoint: "/bcl/v2/balanceAccounts",
        requestBody: baBody,
        responseBody: createdBa,
        status: 200,
      });
    }
    balanceAccounts = await fetchBalanceAccounts();
  }

  const balanceAccount = pickPrimaryBalanceAccount(balanceAccounts);

  const capabilities = accountHolder.capabilities || {};
  const findFirstTransferInstrumentId = (capability) =>
    String(
      (capability?.transferInstruments || []).find((ti) => ti?.id)?.id || ""
    ).trim();
  const transferInstrumentIdFromCapabilities =
    findFirstTransferInstrumentId(capabilities.sendToTransferInstrument) ||
    findFirstTransferInstrumentId(capabilities.receiveFromTransferInstrument) ||
    "";

  // Best-effort lookup of the paymentProcessing business line + its store. Checkout
  // needs `storeId` to call /payments, so this must be in the session — not lazy.
  // Failures are non-fatal: login still succeeds with empty values.
  let paymentsBusinessLineId = "";
  let storeId = "";
  let storeReference = "";
  try {
    const ctx = await lookupOnboardingContext(legalEntityId);
    paymentsBusinessLineId = ctx.paymentsBusinessLineId || "";
    storeId = ctx.storeId || "";
    storeReference = ctx.storeReference || "";
  } catch (ctxError) {
    console.error("[hydrate] onboarding-context lookup failed:", ctxError?.message || ctxError);
  }

  return {
    accountHolderId: accountHolder.id,
    balanceAccountId: balanceAccount?.id || "",
    legalEntityId,
    transferInstrumentId: transferInstrumentIdFromCapabilities,
    email: accountHolder.reference || "",
    companyName: accountHolder.description || "Business",
    capabilities,
    accountHolderStatus: accountHolder.status || "",
    balanceAccounts,
    paymentsBusinessLineId,
    storeId,
    storeReference,
  };
}

// Looks up the paymentProcessing business line and its store for a legal entity.
// Called from both the login hydrate path and the Onboarding tab's lazy fetch.
export async function lookupOnboardingContext(legalEntityId) {
  const normalizedLegalEntityId = String(legalEntityId || "").trim();
  if (!normalizedLegalEntityId) {
    return { paymentsBusinessLineId: "", storeId: "", storeReference: "" };
  }

  let paymentsBusinessLineId = "";
  let storeId = "";
  let storeReference = "";

  try {
    const businessLinesResponse = await adyenLemRequest(
      `/legalEntities/${encodeURIComponent(normalizedLegalEntityId)}/businessLines`,
      "GET"
    );
    const businessLines = Array.isArray(businessLinesResponse?.businessLines)
      ? businessLinesResponse.businessLines
      : [];
    const paymentsBL = businessLines.find((bl) => bl?.service === "paymentProcessing");
    paymentsBusinessLineId = String(paymentsBL?.id || "").trim();
  } catch (blError) {
    console.error("[onboarding-context] business line lookup failed:", blError?.message || blError);
  }

  if (paymentsBusinessLineId) {
    try {
      const merchantAccount = String(process.env.ADYEN_MERCHANT_ACCOUNT || "").trim();
      if (merchantAccount) {
        const storesResponse = await adyenManagementRequest(
          `/merchants/${encodeURIComponent(merchantAccount)}/stores?pageSize=100`,
          "GET"
        );
        const stores = Array.isArray(storesResponse?.data)
          ? storesResponse.data
          : Array.isArray(storesResponse?.stores)
            ? storesResponse.stores
            : [];
        const matchingStore = stores.find(
          (s) => Array.isArray(s?.businessLineIds) && s.businessLineIds.includes(paymentsBusinessLineId)
        );
        storeId = String(matchingStore?.id || "").trim();
        storeReference = String(matchingStore?.reference || "").trim();
      }
    } catch (storeError) {
      console.error("[onboarding-context] store lookup failed:", storeError?.message || storeError);
    }
  }

  return { paymentsBusinessLineId, storeId, storeReference };
}
