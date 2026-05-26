import { warmAccountHolderCache } from "@/lib/accountHolderSession";

export async function POST() {
  try {
    const result = await warmAccountHolderCache();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error?.message || "Failed to warm account holder cache." },
      { status: error?.status || 500 }
    );
  }
}
