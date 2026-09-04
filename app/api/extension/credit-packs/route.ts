import { NextResponse } from "next/server";
import { CREDIT_PACKS } from "@/lib/creditPacks";

/**
 * Public, unauthenticated — no user-specific data, just current pricing
 * (lib/creditPacks.ts, the same source components/BuyCredits.tsx reads
 * directly at build time). The extension has no bundler to import that
 * module into extension/popup.js at build time, so it fetches this instead,
 * at runtime, which also means pricing changes never need a matching
 * extension release.
 */
export async function GET() {
  return NextResponse.json({ packs: CREDIT_PACKS });
}
