import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitGeneration } from "@/lib/generateModel";

/**
 * Token-authed twin of app/api/generate/route.ts, for the Chrome extension.
 * Independently verifies its own caller via a Bearer personal access token
 * (CLAUDE.md rule 30) before ever reaching the shared pipeline in
 * lib/generateModel.ts.
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

  const admin = createAdminClient();
  const result = await submitGeneration(
    userId,
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
      // No Supabase JWT exists for a token-authed caller — consume_credit's
      // own auth.uid() check would always fail here. consume_credit_service
      // (migration 0019) is the service_role-only twin for exactly this:
      // resolveApiToken() above is what already verified this uid.
      const { data, error } = await admin.rpc("consume_credit_service", { uid: userId });
      return error ? { error: true } : { consumed: Boolean(data) };
    },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ modelId: result.modelId }, { status: 202 });
}
