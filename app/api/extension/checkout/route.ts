import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { startCheckout } from "@/lib/checkout";

/**
 * Token-authed twin of app/api/checkout/route.ts, for the Chrome extension.
 * The popup itself can't navigate to pay.wire.mn (a different origin, and
 * popups close the instant they lose focus) — extension/popup.js opens the
 * returned `url` in a real new tab via chrome.tabs.create instead, same
 * hosted-checkout destination the web app's BuyCredits.tsx sends the whole
 * page to.
 */
export async function POST(request: Request) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Буруу JSON бие" }, { status: 400 });
  }

  const { packId, idempotencyKey } = (body ?? {}) as {
    packId?: unknown;
    idempotencyKey?: unknown;
  };

  const result = await startCheckout(userId, { packId, idempotencyKey }, new URL(request.url).origin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url }, { status: 200 });
}
