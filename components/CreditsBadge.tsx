"use client";

import { Badge } from "@/components/ui/Badge";
import { useCredits } from "@/hooks/useCredits";

export function CreditsBadge({ userId }: { userId: string }) {
  const { credits, loading } = useCredits(userId);

  return (
    <Badge variant={credits === 0 ? "warning" : "neutral"}>
      {loading ? "…" : `${credits ?? 0} credits`}
    </Badge>
  );
}
