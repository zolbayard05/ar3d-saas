"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, KeyRound } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface ExistingToken {
  id: string;
  label: string;
  token_last4: string;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Issues/shows/revokes the personal access token the Chrome extension
 * authenticates with (app/api/settings/api-token/route.ts). Same
 * h-12 back-arrow header + glass-card tokens as BuyCredits.tsx (rule 40:
 * no new header pattern per screen).
 *
 * The plaintext token is only ever known to this component for the single
 * render right after POST succeeds — nothing persists it client-side past
 * that (no localStorage), matching the server's own "shown once" guarantee.
 */
export function ApiTokenSettings() {
  const [existing, setExisting] = useState<ExistingToken | null | undefined>(undefined);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-token")
      .then((res) => res.json())
      .then((body) => setExisting(body.token ?? null))
      .catch(() => setExisting(null));
  }, []);

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-token", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Токен үүсгэхэд алдаа гарлаа (${res.status})`);
      setFreshToken(body.token);
      setExisting({ id: "", label: "Chrome Extension", token_last4: body.token.slice(-4), created_at: new Date().toISOString(), last_used_at: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Токен үүсгэхэд алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-token", { method: "DELETE" });
      if (!res.ok) throw new Error("Токен цуцлахад алдаа гарлаа");
      setExisting(null);
      setFreshToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Токен цуцлахад алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-4 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0">
        <Link href="/dashboard" aria-label="Буцах" className="text-text-muted hover:text-text">
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0 lg:pt-6">
        <p className="text-body font-semibold text-text">Chrome өргөтгөл</p>
        <p className="text-small text-text-muted">
          Realify extension-оо холбохын тулд энд токен үүсгээд, extension-ий тохиргоонд paste хийнэ. Токен
          нэг л удаа бүтэн харагдана — хадгалж авахаа мартуузай.
        </p>

        {freshToken && (
          <div className="flex flex-col gap-3 rounded-card border border-glass-border bg-surface-hover p-4 shadow-glass-card">
            <p className="break-all font-mono text-small text-text">{freshToken}</p>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center justify-center gap-2 rounded-md bg-glow-soft py-2.5 text-small font-semibold text-text hover:opacity-90"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Хуулагдлаа" : "Хуулах"}
            </button>
          </div>
        )}

        {existing === undefined && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        )}

        {existing !== undefined && !freshToken && (
          <div className="flex flex-col gap-3 rounded-card border border-glass-border bg-surface-hover p-4 shadow-glass-card">
            {existing ? (
              <>
                <div className="flex items-center gap-2 text-text">
                  <KeyRound className="size-4 text-text-muted" />
                  <span className="font-mono text-small">rf_live_••••{existing.token_last4}</span>
                </div>
                <p className="text-small text-text-muted">
                  {existing.last_used_at
                    ? `Сүүлд ашигласан: ${new Date(existing.last_used_at).toLocaleString("mn-MN")}`
                    : "Одоогоор ашиглагдаагүй байна"}
                </p>
              </>
            ) : (
              <p className="text-small text-text-muted">Идэвхтэй токен алга байна.</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-md bg-glow-soft py-2.5 text-small font-semibold text-text hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Spinner size="sm" /> : existing ? "Шинэ токен үүсгэх (хуучныг цуцална)" : "Токен үүсгэх"}
        </button>

        {existing && !freshToken && (
          <button
            type="button"
            onClick={() => void handleRevoke()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-md border border-glass-border py-2.5 text-small font-semibold text-danger hover:opacity-90 disabled:opacity-40"
          >
            Токен цуцлах
          </button>
        )}

        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
