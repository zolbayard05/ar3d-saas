import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Нэвтрэх линкийн хугацаа дууссан</CardTitle>
          <CardDescription>
            Энэ линк хүчингүй болсон байна. Дахин нэвтрэхийн тулд шинэ линк хүсэлт гаргана уу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: "primary", size: "md" })}>
            Нэвтрэх хуудас руу буцах
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
