// One-off live verification for Phase 1: signup trigger, atomic
// consume_credit, adversarial RLS, column-level self-escalation, and
// refund_credit idempotency.
// Creates two throwaway users + throwaway model rows, asserts on each
// step, and deletes everything it created at the end (safe to re-run).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error("Missing one of NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const stamp = Date.now();
const PASSWORD = "verify-phase1-" + Math.random().toString(36).slice(2) + "Aa1!";

async function createTestUser(label) {
  const email = `verify-phase1-${label}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}) failed: ${error.message}`);
  return data.user;
}

async function clientAs(email) {
  const client = createClient(url, publishableKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return client;
}

let userA, userB, clientA, testModelId, testModelIdA;

try {
  // --- setup -----------------------------------------------------------
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  clientA = await clientAs(userA.email);

  // --- 1. signup trigger -------------------------------------------------
  const { data: profileA } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
  record("signup trigger creates profiles row with 10 credits", profileA?.credits === 10, `got credits=${profileA?.credits}`);

  // --- 2. consume_credit atomicity ---------------------------------------
  let successes = 0;
  let lastResult;
  for (let i = 0; i < 11; i++) {
    const { data, error } = await clientA.rpc("consume_credit", { uid: userA.id });
    if (error) throw new Error(`consume_credit call ${i + 1} errored: ${error.message}`);
    lastResult = data;
    if (data === true) successes++;
  }
  const { data: profileAAfter } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
  record(
    "consume_credit: exactly 10 of 11 calls succeed, 11th returns false, credits=0",
    successes === 10 && lastResult === false && profileAAfter?.credits === 0,
    `successes=${successes}, 11th call result=${lastResult}, final credits=${profileAAfter?.credits}`,
  );

  // --- setup a model owned by user B for the adversarial tests ----------
  const { data: modelB, error: modelBErr } = await admin
    .from("models")
    .insert({ user_id: userB.id, source_image_key: "test/probe.jpg", status: "processing" })
    .select("id")
    .single();
  if (modelBErr) throw new Error(`setup: inserting user B's model failed: ${modelBErr.message}`);
  testModelId = modelB.id;

  // --- 3. adversarial RLS: user A against user B's rows -------------------
  const { data: selectAsA } = await clientA.from("models").select("id").eq("id", testModelId);
  record("RLS: user A cannot SELECT user B's model", (selectAsA?.length ?? 0) === 0, `rows returned=${selectAsA?.length ?? 0}`);

  const { data: titleBefore } = await admin.from("models").select("title").eq("id", testModelId).single();
  const { data: updateAsA } = await clientA
    .from("models")
    .update({ title: "hacked-by-a" })
    .eq("id", testModelId)
    .select("id");
  const { data: titleAfter } = await admin.from("models").select("title").eq("id", testModelId).single();
  record(
    "RLS: user A cannot UPDATE user B's model (zero rows affected AND value unchanged on re-read)",
    (updateAsA?.length ?? 0) === 0 && titleAfter?.title === titleBefore?.title,
    `rows affected=${updateAsA?.length ?? 0}, title before="${titleBefore?.title}" after="${titleAfter?.title}"`,
  );

  const { data: creditsBBeforeAttack } = await admin.from("profiles").select("credits").eq("id", userB.id).single();
  const { data: updateCreditsAsA } = await clientA
    .from("profiles")
    .update({ credits: 999999 })
    .eq("id", userB.id)
    .select("id");
  const { data: creditsBAfterAttack } = await admin.from("profiles").select("credits").eq("id", userB.id).single();
  record(
    "RLS: user A cannot UPDATE user B's profiles.credits (zero rows affected AND value unchanged on re-read)",
    (updateCreditsAsA?.length ?? 0) === 0 && creditsBAfterAttack?.credits === creditsBBeforeAttack?.credits,
    `rows affected=${updateCreditsAsA?.length ?? 0}, credits before=${creditsBBeforeAttack?.credits} after=${creditsBAfterAttack?.credits}`,
  );

  const { error: insertAsAErr } = await clientA
    .from("models")
    .insert({ user_id: userB.id, source_image_key: "test/probe2.jpg" });
  record(
    "RLS: user A cannot INSERT a model claiming user_id = user B",
    Boolean(insertAsAErr),
    insertAsAErr ? `rejected: ${insertAsAErr.message}` : "insert SUCCEEDED — SECURITY HOLE",
  );

  // --- 3a. INSERT-side self-escalation (migration 0005) --------------------
  // A row-ownership-satisfying insert used to be enough to set status='ready'
  // and a fabricated glb_url, self-granting a "completed" model with no
  // credit spent and no generation run. 0005 revokes INSERT on models from
  // authenticated entirely — even a legitimate-looking self-owned insert
  // must now fail, not just an escalating one.
  const { data: selfInsertData, error: selfInsertErr } = await clientA
    .from("models")
    .insert({
      user_id: userA.id,
      source_image_key: "test/self-insert.jpg",
      status: "ready",
      glb_url: "https://evil.example/fake.glb",
    })
    .select("id");
  if (selfInsertData?.[0]?.id) {
    await admin.from("models").delete().eq("id", selfInsertData[0].id);
  }
  record(
    "self-escalation: user A cannot INSERT their own models row (insert is service_role only)",
    Boolean(selfInsertErr),
    selfInsertErr ? `rejected: ${selfInsertErr.message}` : "insert SUCCEEDED — SECURITY HOLE",
  );

  // --- 4. self-escalation: column-level privileges on the user's OWN row --
  // RLS's owner policies (auth.uid() = id / user_id) pass for these — a
  // user updating their own row is legitimate by row ownership. The block
  // has to come from column-level grants, not RLS. Re-read via admin after
  // each attempt rather than trusting the client response, same as the
  // adversarial checks above.
  const { data: creditsABeforeSelf } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
  const { error: selfCreditsErr } = await clientA
    .from("profiles")
    .update({ credits: 999999 })
    .eq("id", userA.id);
  const { data: creditsAAfterSelf } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
  record(
    "self-escalation: user A cannot raise their own credits",
    Boolean(selfCreditsErr) && creditsAAfterSelf?.credits === creditsABeforeSelf?.credits,
    `error=${selfCreditsErr ? selfCreditsErr.message : "none — SECURITY HOLE"}, credits before=${creditsABeforeSelf?.credits} after=${creditsAAfterSelf?.credits}`,
  );

  const { data: planABeforeSelf } = await admin.from("profiles").select("plan").eq("id", userA.id).single();
  const { error: selfPlanErr } = await clientA
    .from("profiles")
    .update({ plan: "pro" })
    .eq("id", userA.id);
  const { data: planAAfterSelf } = await admin.from("profiles").select("plan").eq("id", userA.id).single();
  record(
    "self-escalation: user A cannot change their own plan",
    Boolean(selfPlanErr) && planAAfterSelf?.plan === planABeforeSelf?.plan,
    `error=${selfPlanErr ? selfPlanErr.message : "none — SECURITY HOLE"}, plan before="${planABeforeSelf?.plan}" after="${planAAfterSelf?.plan}"`,
  );

  const { data: modelA, error: modelAErr } = await admin
    .from("models")
    .insert({ user_id: userA.id, source_image_key: "test/probe-a.jpg", status: "pending" })
    .select("id, status, glb_url")
    .single();
  if (modelAErr) throw new Error(`setup: inserting user A's model failed: ${modelAErr.message}`);
  testModelIdA = modelA.id;

  const { error: selfStatusErr } = await clientA
    .from("models")
    .update({ status: "ready", glb_url: "https://evil.example/fake.glb" })
    .eq("id", testModelIdA);
  const { data: modelAAfterSelf } = await admin.from("models").select("status, glb_url").eq("id", testModelIdA).single();
  record(
    "self-escalation: user A cannot set their own model's status='ready' with a fabricated glb_url",
    Boolean(selfStatusErr) && modelAAfterSelf?.status === "pending" && modelAAfterSelf?.glb_url === null,
    `error=${selfStatusErr ? selfStatusErr.message : "none — SECURITY HOLE"}, status after=${modelAAfterSelf?.status}, glb_url after=${modelAAfterSelf?.glb_url}`,
  );

  const { error: selfTitleErr } = await clientA
    .from("models")
    .update({ title: "my model" })
    .eq("id", testModelIdA);
  const { data: modelAAfterTitle } = await admin.from("models").select("title").eq("id", testModelIdA).single();
  record(
    "self-escalation control: user A CAN update their own model's title (allowed column)",
    !selfTitleErr && modelAAfterTitle?.title === "my model",
    `error=${selfTitleErr ? selfTitleErr.message : "none"}, title after="${modelAAfterTitle?.title}"`,
  );

  // --- 5. refund_credit: permission + idempotency -------------------------
  const { error: refundAsAErr } = await clientA.rpc("refund_credit", { model_id: testModelId });
  record(
    "refund_credit: authenticated (non-service_role) caller is rejected",
    Boolean(refundAsAErr),
    refundAsAErr ? `rejected: ${refundAsAErr.message}` : "call SUCCEEDED — should be service_role only",
  );

  const { data: creditsBBefore } = await admin.from("profiles").select("credits").eq("id", userB.id).single();
  const { data: refund1 } = await admin.rpc("refund_credit", { model_id: testModelId, failure_reason: "test failure" });
  const { data: creditsBAfterFirst } = await admin.from("profiles").select("credits").eq("id", userB.id).single();
  const { data: refund2 } = await admin.rpc("refund_credit", { model_id: testModelId, failure_reason: "retried webhook" });
  const { data: creditsBAfterSecond } = await admin.from("profiles").select("credits").eq("id", userB.id).single();

  record(
    "refund_credit: idempotent — balance increases exactly once across two calls",
    refund1 === true &&
      creditsBAfterFirst.credits === creditsBBefore.credits + 1 &&
      refund2 === false &&
      creditsBAfterSecond.credits === creditsBAfterFirst.credits,
    `before=${creditsBBefore.credits}, after1(${refund1})=${creditsBAfterFirst.credits}, after2(${refund2})=${creditsBAfterSecond.credits}`,
  );
} finally {
  // --- cleanup -------------------------------------------------------------
  if (testModelId) await admin.from("models").delete().eq("id", testModelId);
  if (testModelIdA) await admin.from("models").delete().eq("id", testModelIdA);
  if (userA) await admin.auth.admin.deleteUser(userA.id);
  if (userB) await admin.auth.admin.deleteUser(userB.id);
  console.log("\nCleanup done.");
}

console.log("\n=== SUMMARY ===");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
const allPass = results.every((r) => r.pass);
console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(allPass ? 0 : 1);
