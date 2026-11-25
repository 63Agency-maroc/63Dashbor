"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { postEmailDiag, type EmailDiagMode } from "@/lib/api/email-diag";
import { useAuth } from "@/components/providers/AuthProvider";

export function EmailDiagPanel() {
  const { user } = useAuth();
  const [to, setTo] = useState(() => (user?.email ?? "").trim());
  const [busy, setBusy] = useState<EmailDiagMode | null>(null);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = (user?.email ?? "").trim();
    if (email) setTo((prev) => prev.trim() || email);
  }, [user?.email]);

  async function send(mode: EmailDiagMode) {
    const addr = to.trim();
    if (!addr) {
      setError("Email destinataire requis.");
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const res = await postEmailDiag({ to: addr, mode });
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult("");
      setError(err instanceof ApiError ? err.message : "Échec du diagnostic.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h6>Diagnostic Email</h6>
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="email-diag-to">To </label>
        <input
          id="email-diag-to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={busy !== null}
          style={{ minWidth: 280 }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {(["RAW", "FULL", "PIXEL", "UNSUB", "HEADERS"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={busy !== null}
            onClick={() => void send(mode)}
          >
            {busy === mode ? "…" : mode === "RAW" || mode === "FULL" ? `Envoyer ${mode}` : mode}
          </button>
        ))}
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {result ? (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 420, overflow: "auto" }}>
          {result}
        </pre>
      ) : null}
    </div>
  );
}
