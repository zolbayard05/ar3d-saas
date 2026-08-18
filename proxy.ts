import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the `middleware` file convention to `proxy` — same
// mechanism, new name (see node_modules/next/dist/docs/.../proxy.md).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)",
  ],
};
