import { Box } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

// Model generation (upload -> Tripo -> AR viewer) ships in Phase 2/3 — this
// is a placeholder proving the protected shell, tokens, and primitives work.
export default function DashboardPage() {
  return (
    <EmptyState
      icon={<Box className="size-10" />}
      title="No models yet"
      description="Upload a photo to generate your first 3D model. This flow lands in Phase 2."
      action={<Button disabled>Generate a model</Button>}
    />
  );
}
