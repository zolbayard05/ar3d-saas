// Flags an admin's existing ready models as showcase (migration 0013).
// Service-role only, by design — is_showcase has zero client grant (see that
// migration's own comment), so this is the actual write path, not a
// convenience wrapper around one that also exists elsewhere.
//
//   node --env-file=.env.local scripts/flag-showcase-models.mjs zolbayar.d05@gmail.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/flag-showcase-models.mjs <admin-email>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: userError } = await admin.auth.admin.listUsers();
if (userError) throw userError;
const user = users.users.find((u) => u.email === email);
if (!user) {
  console.error(`No auth user with email ${email}`);
  process.exit(1);
}

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("is_admin")
  .eq("id", user.id)
  .single();
if (profileError) throw profileError;
if (!profile.is_admin) {
  console.error(`${email} is not is_admin — refusing to flag showcase models for a non-admin account.`);
  process.exit(1);
}

const { data: updated, error } = await admin
  .from("models")
  .update({ is_showcase: true })
  .eq("user_id", user.id)
  .eq("status", "ready")
  .select("id, title");

if (error) throw error;

console.log(`Flagged ${updated.length} model(s) as showcase for ${email}:`);
for (const row of updated) {
  console.log(`  ${row.id}: ${row.title ?? "(untitled)"}`);
}
