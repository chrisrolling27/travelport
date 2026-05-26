import { getScoreboard, recordPurchase, recordSale } from "@/lib/scoreboardStore";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountHolderId = searchParams.get("accountHolderId");
  if (!accountHolderId) {
    return Response.json({ error: "accountHolderId is required." }, { status: 400 });
  }
  return Response.json(getScoreboard(accountHolderId));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { accountHolderId, type, ...rest } = body || {};
    if (!accountHolderId) {
      return Response.json({ error: "accountHolderId is required." }, { status: 400 });
    }
    if (type !== "sale" && type !== "purchase") {
      return Response.json({ error: "type must be 'sale' or 'purchase'." }, { status: 400 });
    }
    const entry = type === "sale" ? recordSale(accountHolderId, rest) : recordPurchase(accountHolderId, rest);
    return Response.json({ ok: true, entry, scoreboard: getScoreboard(accountHolderId) });
  } catch (error) {
    return Response.json({ error: error?.message || "Failed to record." }, { status: 500 });
  }
}
