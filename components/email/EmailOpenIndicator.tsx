"use client";

import { useEffect, useState } from "react";
import { getEmailOpens, type EmailOpenEvent } from "@/lib/api/email-opens";
import { formatDateTime } from "@/lib/utils/date";

type Props = {
  email?: string | null;
  className?: string;
};

type LoadState = "loading" | "empty" | "ready";

function pickLatest(list: EmailOpenEvent[]): EmailOpenEvent | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) =>
    String(b.sentAt ?? "").localeCompare(String(a.sentAt ?? "")),
  )[0];
}

export function EmailOpenIndicator({ email, className }: Props) {
  const addr = (email ?? "").trim();
  const [state, setState] = useState<LoadState>(addr ? "loading" : "empty");
  const [row, setRow] = useState<EmailOpenEvent | null>(null);

  useEffect(() => {
    if (!addr) {
      setState("empty");
      setRow(null);
      return;
    }
    let cancelled = false;
    setState("loading");
    setRow(null);
    void getEmailOpens(addr, 1)
      .then((list) => {
        if (cancelled) return;
        const best = pickLatest(list);
        setRow(best);
        setState(best ? "ready" : "empty");
      })
      .catch(() => {
        if (cancelled) return;
        setRow(null);
        setState("empty");
      });
    return () => {
      cancelled = true;
    };
  }, [addr]);

  if (!addr) return null;

  if (state === "loading") {
    return (
      <span
        className={`email-open-indicator text-muted ${className ?? ""}`.trim()}
        aria-hidden
      >
        <span
          className="spinner-border spinner-border-sm"
          style={{ width: 12, height: 12, borderWidth: 1.5 }}
        />
      </span>
    );
  }

  if (state === "empty" || !row) return null;

  const opened = Boolean(row.openedAt);
  const color = opened ? "#16a34a" : "#9ca3af";
  const sentLabel = row.sentAt ? formatDateTime(row.sentAt) : "—";
  const title = opened
    ? `Envoyé le ${sentLabel} · Ouvert le ${formatDateTime(row.openedAt)} · ${row.openCount}×`
    : `Envoyé le ${sentLabel} · Pas encore ouvert`;

  return (
    <span
      className={`email-open-indicator ${className ?? ""}`.trim()}
      title={title}
      role="img"
      aria-label={title}
      style={{ color, cursor: "default", lineHeight: 1, display: "inline-flex" }}
    >
      <i className="fi fi-rr-eye" aria-hidden />
    </span>
  );
}
