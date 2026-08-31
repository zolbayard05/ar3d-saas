import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { resolveApiToken } from "@/lib/apiToken";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildModelUrl } from "@/lib/models";

/**
 * Status poll for the Chrome extension popup. The extension has no
 * Supabase session, so it can't use client-side Realtime the way the web
 * app does (rule 14 is about the web app's own client) — this is the one
 * deliberate exception, driven by "no Supabase session available here" for
 * a token-authed caller, not by choice. Polled every ~2.5s while
 * pending/processing, same order of magnitude as the web app's own
 * GeneratingStep.tsx UX.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: model } = await admin
    .from("models")
    .select("id, user_id, status, glb_url, usdz_url")
    .eq("id", id)
    .maybeSingle();

  // Same shape for "doesn't exist" and "exists but isn't yours" — an
  // extension caller may only ever learn about its own rows.
  if (!model || model.user_id !== userId) {
    return NextResponse.json({ error: "Model олдсонгүй" }, { status: 404 });
  }

  const shareUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/models/${model.id}`;

  // Generated server-side (Node's pure-JS PNG encoder, no canvas/DOM) so
  // the extension popup doesn't need to vendor a QR library of its own —
  // Chrome Web Store review disallows remotely-hosted script anyway, and
  // this reuses the same `qrcode` dependency lib/qr.ts already uses
  // browser-side for the web app's own share card.
  const qrDataUrl = model.status === "ready" ? await QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 }) : null;

  return NextResponse.json({
    status: model.status,
    glbUrl: model.glb_url ? buildModelUrl(model.glb_url) : null,
    usdzUrl: model.usdz_url ? buildModelUrl(model.usdz_url) : null,
    shareUrl,
    qrDataUrl,
  });
}
