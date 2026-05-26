import { lookupOnboardingContext } from "@/lib/accountHolderSession";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const legalEntityId = searchParams.get("legalEntityId");
    if (!legalEntityId) {
      return Response.json({ error: "legalEntityId is required." }, { status: 400 });
    }
    const data = await lookupOnboardingContext(legalEntityId);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to load onboarding context.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}
