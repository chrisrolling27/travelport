import { adyenLemRequest, adyenLemV4Request } from "@/lib/adyen";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const legalEntityId = searchParams.get("legalEntityId");
    if (!legalEntityId) return Response.json({ error: "legalEntityId is required." }, { status: 400 });

    const data = await adyenLemRequest(`/legalEntities/${legalEntityId}/businessLines`, "GET");
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch business lines.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { legalEntityId, industryCode, webAddress, businessName } = await request.json();
    if (!legalEntityId) return Response.json({ error: "legalEntityId is required." }, { status: 400 });
    if (!industryCode) return Response.json({ error: "industryCode is required." }, { status: 400 });
    if (!webAddress) return Response.json({ error: "webAddress is required." }, { status: 400 });
    if (!businessName) return Response.json({ error: "businessName is required." }, { status: 400 });

    const data = await adyenLemV4Request("/businessLines", "POST", {
      legalEntityId,
      industryCode,
      service: "issuing",
      webData: [{ webAddress }],
      sourceOfFunds: {
        adyenProcessedFunds: true,
      },
    });

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create business line.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

