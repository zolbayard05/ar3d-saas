import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client — bypasses RLS entirely. `import "server-only"` makes
 * any accidental import from a Client Component a BUILD ERROR, not a
 * runtime leak: this must only ever be reached from route handlers /
 * webhooks / other server-only modules (e.g. the Tripo webhook handler
 * needs to write `models` rows the uploading user doesn't own yet).
 *
 * Never import this from anything under app/**\/page.tsx marked "use client"
 * or from components/**.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
