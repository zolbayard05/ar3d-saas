import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg p-6 text-center">
      <h1 className="text-display font-semibold text-text">
        Turn a photo into 3D — place it in your room
      </h1>
      <p className="max-w-md text-body text-text-muted">
        Upload a picture, get a 3D model, and view it in AR right from your phone browser.
      </p>
      <Link href="/login" className={buttonVariants({ variant: "primary", size: "lg" })}>
        Get started
      </Link>
    </main>
  );
}
