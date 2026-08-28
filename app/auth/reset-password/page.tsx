"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

// Reached only via the reset-link's own recovery session (established by
// /auth/confirm before redirecting here — see hooks/useAuth.ts's
// sendPasswordReset). No "old password" field: the recovery session itself
// is the proof of identity, same as every other password-reset flow.
export default function ResetPasswordPage() {
  const { status, error, updatePassword } = useAuth();
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) void updatePassword(password);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Realify" className="size-16 rounded-md" />
          <h1 className="text-center text-display font-semibold text-text">Шинэ нууц үг тохируулах</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <Input
            type="password"
            aria-label="Шинэ нууц үг"
            placeholder="Шинэ нууц үг"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" variant="primary" className="w-full" loading={status === "sending"}>
            Нууц үг шинэчлэх
          </Button>
          {status === "error" && <p className="text-small text-danger">{error}</p>}
        </form>
      </div>
    </main>
  );
}
