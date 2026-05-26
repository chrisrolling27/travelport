export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const useDropIn = searchParams.get("flow") === "dropin";

  const clientKey = useDropIn
    ? process.env.DROP_IN_NEXT_PUBLIC_ADYEN_CLIENT_KEY || ""
    : process.env.ADYEN_CLIENT_SIDE_KEY || process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || "";

  if (!clientKey) {
    return Response.json(
      {
        error: useDropIn
          ? "Missing Drop-in Adyen client key. Set DROP_IN_NEXT_PUBLIC_ADYEN_CLIENT_KEY."
          : "Missing Adyen client key. Set ADYEN_CLIENT_SIDE_KEY or NEXT_PUBLIC_ADYEN_CLIENT_KEY.",
      },
      { status: 500 }
    );
  }

  return Response.json({ clientKey });
}
