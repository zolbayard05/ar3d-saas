// Creates (or updates the password on) a confirmed test user via the admin
// client, entirely bypassing email delivery — for use with the dev-only
// password sign-in on /login (see hooks/useAuth.ts, gated on
// NODE_ENV === "development"). Exists because Supabase's free-tier email
// rate limit blocks repeated magic-link testing; this sidesteps email
// entirely rather than working around the limit.
//
// Usage:
//   node --env-file=.env.local scripts/create-dev-test-user.mjs \
//     --email dev@example.com --password "some-password"
import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

const { email, password } = parseArgs();
if (!email || !password) {
  console.error(
    'Usage: node --env-file=.env.local scripts/create-dev-test-user.mjs --email dev@example.com --password "some-password"',
  );
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters (Supabase's minimum).");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: existing, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw new Error(`listUsers failed: ${listError.message}`);
const match = existing.users.find((u) => u.email === email);

if (match) {
  const { error } = await admin.auth.admin.updateUserById(match.id, { password });
  if (error) throw new Error(`updateUserById failed: ${error.message}`);
  console.log(`Updated password for existing user ${email} (${match.id})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skips the confirmation email entirely
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  console.log(`Created user ${email} (${data.user.id})`);
}

console.log(`\nSign in at http://localhost:3000/login with:`);
console.log(`  email:    ${email}`);
console.log(`  password: ${password}`);
