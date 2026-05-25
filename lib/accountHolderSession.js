import { adyenLemV4Request, adyenPlatformRequest } from "@/lib/adyen";

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

export async function findAccountHolderByReference(email) {
  const normalizedEmail = normalizeReferenceEmail(email);
  if (!normalizedEmail || !SIMPLE_EMAIL_REGEX.test(normalizedEmail)) return null;

  try {
    const accountHolders = await listAllAccountHoldersForBalancePlatform();
    return accountHolders.find((ah) => accountHolderMatchesLoginEmail(ah, normalizedEmail)) || null;
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
  };
}
