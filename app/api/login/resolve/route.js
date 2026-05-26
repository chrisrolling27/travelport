import { findAccountHolderByReference, warmAccountHolderCache } from "@/lib/accountHolderSession";

export async function POST(request) {
  try {
    const { email } = await request.json().catch(() => ({}));
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@") || normalized.length < 5) {
      return Response.json({ accountHolderId: "" });
    }

    // Make sure the cache has been warmed before we try the lookup. After the
    // first warm this is essentially free (TTL short-circuits the work).
    await warmAccountHolderCache().catch(() => null);

    const ah = await findAccountHolderByReference(normalized);
    return Response.json({ accountHolderId: ah?.id || "" });
  } catch (error) {
    // Resolve is best-effort — never block the user's ability to submit the login form.
    return Response.json({ accountHolderId: "", error: error?.message || "resolve failed" });
  }
}
