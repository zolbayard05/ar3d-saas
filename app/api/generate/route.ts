import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitGeneration } from "@/lib/generateModel";

/**
 * Kicks off generation for an already-uploaded photo, for the cookie-authed
 * web app. Auth resolution only — the actual pipeline (CLAUDE.md rule 12:
 * deduct credit -> insert a `pending` models row -> submit to the provider
 * -> return 202 immediately) lives in lib/generateModel.ts, shared with
 * app/api/extension/generate/route.ts so rule 16-19's guarantees can't
 * drift between the two entry points.
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

  const {
    sourceImageKey,
    idempotencyKey,
    sourceImageWidth,
    sourceImageHeight,
    sourceImageKeyLeft,
    sourceImageKeyBack,
    sourceImageKeyRight,
  } = (body ?? {}) as {
    sourceImageKey?: unknown;
    idempotencyKey?: unknown;
    sourceImageWidth?: unknown;
    sourceImageHeight?: unknown;
    sourceImageKeyLeft?: unknown;
    sourceImageKeyBack?: unknown;
    sourceImageKeyRight?: unknown;
  };

  const result = await submitGeneration(
    user.id,
    {
      sourceImageKey,
      idempotencyKey,
      sourceImageWidth,
      sourceImageHeight,
      sourceImageKeyLeft,
      sourceImageKeyBack,
      sourceImageKeyRight,
    },
    async () => {
      // A real Supabase JWT is available here — consume_credit(uid)'s own
      // auth.uid() = uid check (migration 0001) is the right one for this
      // cookie-authed path.
      const { data, error } = await supabase.rpc("consume_credit", { uid: user.id });
      return error ? { error: true } : { consumed: Boolean(data) };
    },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ modelId: result.modelId }, { status: 202 });
}
