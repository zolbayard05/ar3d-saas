import Link from "next/link";
import { CreditsBadge } from "@/components/CreditsBadge";
import { SignOutButton } from "@/components/SignOutButton";

export interface AppHeaderProps {
  userId: string;
}

export function AppHeader({ userId }: AppHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-6">
      <Link href="/dashboard" className="text-heading font-semibold text-text">
        AR3D
      </Link>
      <div className="flex items-center gap-3">
        <CreditsBadge userId={userId} />
        <SignOutButton />
      </div>
    </header>
  );
}
