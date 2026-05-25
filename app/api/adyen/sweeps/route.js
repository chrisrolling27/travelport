import { adyenPlatformRequest } from "@/lib/adyen";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const balanceAccountId = searchParams.get("balanceAccountId");
    if (!balanceAccountId) return Response.json({ error: "balanceAccountId is required." }, { status: 400 });

    // Source of truth for existing sweeps: direct BA endpoint.
    const data = await adyenPlatformRequest(
      `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps`,
      "GET"
    );
    const sweeps = data?.data || data?.sweeps || [];
    const orderedSweeps = [...sweeps].sort((a, b) => {
      const aCreated = new Date(a?.createdAt || 0).getTime();
      const bCreated = new Date(b?.createdAt || 0).getTime();
      return bCreated - aCreated;
    });
    const activeSweep = orderedSweeps.find((item) => item?.status === "active");

    return Response.json({
      sweep: activeSweep || orderedSweeps[0] || null,
      sweeps: orderedSweeps,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch sweeps.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      accountHolderId,
      balanceAccountId,
      transferInstrumentId,
      scheduleType,
      amount,
      currency,
      reference,
    } = await request.json();

    if (!balanceAccountId || !transferInstrumentId) {
      return Response.json(
        { error: "balanceAccountId and transferInstrumentId are required." },
        { status: 400 }
      );
    }

    const allowedScheduleTypes = ["daily", "weekly", "monthly"];
    const selectedSchedule = String(scheduleType || "daily");
    if (!allowedScheduleTypes.includes(selectedSchedule)) {
      return Response.json(
        { error: "scheduleType must be one of: daily, weekly, monthly." },
        { status: 400 }
      );
    }

    const amountMajor = Number(amount);
    const amountMinor = Math.round(amountMajor * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 100 || amountMinor > 999_999) {
      return Response.json({ error: "amount must be between 1 and 9999.99." }, { status: 400 });
    }

    const providedReference = String(reference || "").trim();
    const normalizedReference = providedReference
      ? providedReference.replace(/[^a-z0-9]/gi, "").slice(0, 30)
      : `Sweep${Date.now()}`;
    if (!normalizedReference) {
      return Response.json({ error: "Unable to generate a valid sweep reference." }, { status: 400 });
    }

    if (accountHolderId) {
      const accountHolder = await adyenPlatformRequest(
        `/accountHolders/${encodeURIComponent(accountHolderId)}`,
        "GET"
      );
      const capability = accountHolder?.capabilities?.sendToTransferInstrument;
      const eligibleTransferInstrumentIds = (capability?.transferInstruments || [])
        .filter((instrument) => instrument?.id && instrument?.allowed !== false)
        .map((instrument) => instrument.id);

      if (!capability?.allowed) {
        return Response.json(
          { error: "Account holder does not have sendToTransferInstrument capability." },
          { status: 400 }
        );
      }

      if (!eligibleTransferInstrumentIds.includes(transferInstrumentId)) {
        return Response.json(
          { error: "Selected transfer instrument is not eligible for sendToTransferInstrument capability." },
          { status: 400 }
        );
      }
    }

    const existingSweepsResponse = await adyenPlatformRequest(
      `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps`,
      "GET"
    );
    const existingSweeps = existingSweepsResponse?.data || existingSweepsResponse?.sweeps || [];
    if (existingSweeps.length > 0) {
      return Response.json(
        { error: "Only one sweep can be configured at a time for this account holder." },
        { status: 400 }
      );
    }

    const sweepCurrency = String(currency || "USD").toUpperCase();
    const schedule = { type: selectedSchedule };

    const body = {
      counterparty: { transferInstrumentId },
      currency: sweepCurrency,
      schedule,
      // For push sweeps, Adyen validates sweepAmount <= triggerAmount.
      // We keep UX simple by deriving triggerAmount from the same user-entered amount.
      triggerAmount: {
        value: amountMinor,
        currency: sweepCurrency,
      },
      sweepAmount: {
        value: amountMinor,
        currency: sweepCurrency,
      },
      type: "push",
      reference: normalizedReference,
    };

    const data = await adyenPlatformRequest(
      `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps`,
      "POST",
      body
    );
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create sweep.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { balanceAccountId, sweepId, scheduleType, amount, currency, transferInstrumentId } = await request.json();

    if (!balanceAccountId || !sweepId) {
      return Response.json({ error: "balanceAccountId and sweepId are required." }, { status: 400 });
    }

    const allowedScheduleTypes = ["daily", "weekly", "monthly"];
    const selectedSchedule = String(scheduleType || "");
    if (!allowedScheduleTypes.includes(selectedSchedule)) {
      return Response.json(
        { error: "scheduleType must be one of: daily, weekly, monthly." },
        { status: 400 }
      );
    }

    const amountMajor = Number(amount);
    const amountMinor = Math.round(amountMajor * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 100 || amountMinor > 999_999) {
      return Response.json({ error: "amount must be between 1 and 9999.99." }, { status: 400 });
    }

    const sweepCurrency = String(currency || "USD").toUpperCase();

    const body = {
      schedule: { type: selectedSchedule },
      triggerAmount: {
        value: amountMinor,
        currency: sweepCurrency,
      },
      sweepAmount: {
        value: amountMinor,
        currency: sweepCurrency,
      },
    };

    if (transferInstrumentId) {
      body.counterparty = { transferInstrumentId };
    }

    const data = await adyenPlatformRequest(
      `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps/${encodeURIComponent(sweepId)}`,
      "PATCH",
      body
    );

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to update sweep.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const balanceAccountId = searchParams.get("balanceAccountId");
    const sweepId = searchParams.get("sweepId");

    if (!balanceAccountId || !sweepId) {
      return Response.json({ error: "balanceAccountId and sweepId are required." }, { status: 400 });
    }

    const data = await adyenPlatformRequest(
      `/balanceAccounts/${encodeURIComponent(balanceAccountId)}/sweeps/${encodeURIComponent(sweepId)}`,
      "DELETE"
    );

    return Response.json({ success: true, ...data });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to delete sweep.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

