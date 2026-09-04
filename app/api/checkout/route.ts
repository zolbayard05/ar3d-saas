import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startCheckout } from "@/lib/checkout";

/**
 * Starts a wire.mn hosted-checkout purchase for one credit pack. Auth
 * resolution only — the actual flow (rule 12's async pattern, applied to a
 * payment instead of a generation: validate -> idempotent fast path ->
 * insert a `pending` row via service_role -> call the external provider ->
 * return a redirect target immediately) lives in lib/checkout.ts, shared
 * with app/api/extension/checkout/route.ts.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
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

  const result = await startCheckout(user.id, { packId, idempotencyKey }, new URL(request.url).origin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url }, { status: 200 });
}
