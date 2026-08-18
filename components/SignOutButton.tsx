"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sign out">
      <LogOut className="size-4" />
    </Button>
  );
}
