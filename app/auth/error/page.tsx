import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign-in link expired</CardTitle>
          <CardDescription>
            That link is no longer valid. Request a new one to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: "primary", size: "md" })}>
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
