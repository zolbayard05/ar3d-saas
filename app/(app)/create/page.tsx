import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaptureFlow } from "@/components/CaptureFlow";

// CaptureFlow needs the caller's own id for ConfirmStep's credits line
// (useCredits), not just auth — same reason app/(app)/library/page.tsx
// calls getUser() directly rather than relying on the (app) layout's own
// check alone (rule 30).
export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <CaptureFlow userId={user.id} />;
}
