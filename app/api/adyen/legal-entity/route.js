import { adyenLemRequest } from "@/lib/adyen";

export async function POST(request) {
  try {
    const { legalEntityId } = await request.json();
    if (!legalEntityId) return Response.json({ error: "legalEntityId is required." }, { status: 400 });

    const data = await adyenLemRequest(`/legalEntities/${legalEntityId}`, "GET");
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch legal entity.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

