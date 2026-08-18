import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Server Component / Route Handler / Server Action client — reads the
 * user's own session from cookies, so RLS applies as that user.
 *
 * `setAll` can throw when called from a Server Component (which can't
 * write cookies); that's expected and safe to ignore because proxy.ts
 * already refreshes the session on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — no-op, see doc comment above.
          }
        },
      },
    },
  );
}
