import { adyenPlatformRequest } from "@/lib/adyen";

async function fetchBalanceAccount(balanceAccountId) {
  return adyenPlatformRequest(`/balanceAccounts/${balanceAccountId}`, "GET");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const balanceAccountId = searchParams.get("balanceAccountId");

    if (!balanceAccountId) {
      return Response.json({ error: "balanceAccountId is required." }, { status: 400 });
    }

    const data = await fetchBalanceAccount(balanceAccountId);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch balance account.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { balanceAccountId } = await request.json();
    if (!balanceAccountId) {
      return Response.json({ error: "balanceAccountId is required." }, { status: 400 });
    }

    const data = await fetchBalanceAccount(balanceAccountId);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch balance account.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}
