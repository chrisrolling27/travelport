export async function GET() {
  const clientKey = process.env.ADYEN_CLIENT_SIDE_KEY || process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || "";

  if (!clientKey) {
    return Response.json(
      { error: "Missing Adyen client key. Set ADYEN_CLIENT_SIDE_KEY or NEXT_PUBLIC_ADYEN_CLIENT_KEY." },
      { status: 500 }
    );
  }

  return Response.json({ clientKey });
}
