"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface TokenRow {
  id: string;
  label: string;
  token_last4: string;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Issues/lists/revokes the personal access tokens the Chrome extension
 * authenticates with (app/api/settings/api-token/route.ts). Same
 * h-12 back-arrow header + glass-card tokens as BuyCredits.tsx (rule 40:
 * no new header pattern per screen).
 *
 * Multiple tokens can be active at once — one per device (e.g. "Windows",
 * "iMac") — labeled and independently revocable, after "issuing a new one
 * silently kills the last one" turned out to be a real problem the moment
 * a second machine came into the picture.
 *
 * The plaintext token is only ever known to this component for the single
 * render right after POST succeeds — nothing persists it client-side past
 * that (no localStorage), matching the server's own "shown once" guarantee.
 */
export function ApiTokenSettings() {
  const [tokens, setTokens] = useState<TokenRow[] | undefined>(undefined);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadTokens() {
    return fetch("/api/settings/api-token")
      .then((res) => res.json())
      .then((body) => setTokens(body.tokens ?? []))
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    void loadTokens();
  }, []);

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Токен үүсгэхэд алдаа гарлаа (${res.status})`);
      setFreshToken(body.token);
      setLabel("");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Токен үүсгэхэд алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    setError(null);
    setRevokingId(tokenId);
    try {
      const res = await fetch("/api/settings/api-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      if (!res.ok) throw new Error("Токен цуцлахад алдаа гарлаа");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Токен цуцлахад алдаа гарлаа");
    } finally {
      setRevokingId(null);
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
          Realify extension холбох токен энд үүсгэнэ — компьютер бүрт тусдаа токен ашиглаж болно. Токен нэг л
          удаа бүтэн харагдана, хадгалж авахаа мартуузай.
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

        {tokens === undefined && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        )}

        {tokens !== undefined && tokens.length > 0 && (
          <div className="flex flex-col gap-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-card border border-glass-border bg-surface-hover p-4 shadow-glass-card"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2 text-text">
                    <KeyRound className="size-4 shrink-0 text-text-muted" />
                    <span className="truncate font-medium">{t.label}</span>
                    <span className="shrink-0 font-mono text-small text-text-muted">••••{t.token_last4}</span>
                  </div>
                  <p className="text-small text-text-muted">
                    {t.last_used_at
                      ? `Сүүлд ашигласан: ${new Date(t.last_used_at).toLocaleString("mn-MN")}`
                      : "Одоогоор ашиглагдаагүй байна"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${t.label} токен цуцлах`}
                  onClick={() => void handleRevoke(t.id)}
                  disabled={revokingId === t.id}
                  className="flex shrink-0 items-center justify-center rounded-md p-2 text-text-muted hover:bg-glow-soft hover:text-danger disabled:opacity-40"
                >
                  {revokingId === t.id ? <Spinner size="sm" /> : <Trash2 className="size-4" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {tokens !== undefined && tokens.length === 0 && !freshToken && (
          <p className="text-small text-text-muted">Идэвхтэй токен алга байна.</p>
        )}

        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Нэр (жишээ нь: Windows, iMac) — заавал биш"
            maxLength={60}
            className="rounded-md border border-glass-border bg-surface-hover px-3 py-2.5 text-small text-text placeholder:text-text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-md bg-glow-soft py-2.5 text-small font-semibold text-text hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Spinner size="sm" /> : "Шинэ токен үүсгэх"}
          </button>
        </div>

        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
