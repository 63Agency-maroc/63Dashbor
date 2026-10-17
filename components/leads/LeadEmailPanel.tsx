"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { getLeadEmails, sendLeadEmail, type EmailMessage } from "@/lib/api/leads";
import { getMailAccount } from "@/lib/api/mailAccount";
import { CASABLANCA_TZ, formatDateTime } from "@/lib/utils/date";

type Props = {
  leadId: string;
  leadEmail?: string | null;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function displayBody(message: EmailMessage): string {
  const text = (message.bodyText ?? "").trim();
  if (text) return text;
  const html = message.bodyHtml ?? "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function LeadEmailPanel({ leadId, leadEmail, onToast }: Props) {
  const to = (leadEmail ?? "").trim();
  const hasEmail = Boolean(to);

  const [accountLoading, setAccountLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (!leadId) return;
    setThreadLoading(true);
    setThreadError(null);
    try {
      const list = await getLeadEmails(leadId);
      setMessages(Array.isArray(list) ? list : []);
    } catch (err) {
      setThreadError(err instanceof ApiError ? err.message : "Impossible de charger les emails.");
    } finally {
      setThreadLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setAccountLoading(true);
    setAccountError(null);
    void getMailAccount()
      .then((account) => {
        if (cancelled) return;
        setConfigured(Boolean(account));
      })
      .catch((err) => {
        if (cancelled) return;
        setConfigured(false);
        setAccountError(
          err instanceof ApiError ? err.message : "Impossible de vérifier la boîte mail.",
        );
      })
      .finally(() => {
        if (!cancelled) setAccountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    if (!configured) return;
    void loadThread();
  }, [configured, loadThread]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!hasEmail || sending) return;
    const subjectTrim = subject.trim();
    const bodyTrim = body.trim();
    if (!subjectTrim || !bodyTrim) return;

    setSending(true);
    setSendError(null);
    try {
      await sendLeadEmail(leadId, {
        subject: subjectTrim,
        bodyText: bodyTrim,
        bodyHtml: textToHtml(bodyTrim),
      });
      setSubject("");
      setBody("");
      onToast?.("Email envoyé.", "success");
      await loadThread();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Envoi impossible.";
      setSendError(msg);
      onToast?.(msg, "danger");
    } finally {
      setSending(false);
    }
  }

  if (accountLoading) {
    return (
      <div className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement…</span>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4">
        <div className="card border-0 bg-light w-100" style={{ maxWidth: 420 }}>
          <div className="card-body text-center py-4 px-3">
            <i className="fi fi-rr-envelope fs-2 text-muted d-block mb-2" aria-hidden />
            <p className="mb-3">Connectez votre boîte mail pour envoyer des emails</p>
            {accountError ? <p className="small text-danger">{accountError}</p> : null}
            <Link href="/settings?tab=integrations" className="btn btn-primary btn-sm">
              Intégrations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const composerDisabled = !hasEmail || sending;

  return (
    <div className="lead-email-panel d-flex flex-column h-100">
      <div className="flex-grow-1 overflow-auto px-3 py-3">
        {threadLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Chargement…</span>
            </div>
          </div>
        ) : threadError ? (
          <div className="text-center py-4">
            <p className="text-danger mb-2">{threadError}</p>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void loadThread()}>
              Réessayer
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted mb-0 py-4">Aucun email avec ce lead.</p>
        ) : (
          messages.map((m) => {
            const outbound = m.direction === "outbound";
            const when = formatDateTime(m.sentAt || m.createdAt, CASABLANCA_TZ);
            const bodyText = displayBody(m);
            return (
              <div
                key={m.id || `${m.createdAt}-${m.subject}`}
                className={`d-flex mb-2 ${outbound ? "justify-content-end" : "justify-content-start"}`}
              >
                <article
                  className={`card border mb-0 ${outbound ? "bg-primary-subtle" : "bg-light"}`}
                  style={{ maxWidth: "88%" }}
                >
                  <div className="card-body py-2 px-3">
                    <div className="fw-semibold">{m.subject || "(sans objet)"}</div>
                    <div className="small text-muted">
                      {(m.from || "—")} → {(m.to || "—")}
                    </div>
                    <div className="small text-muted">{when}</div>
                    {bodyText ? (
                      <div className="mt-2 small" style={{ whiteSpace: "pre-wrap" }}>
                        {bodyText}
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })
        )}
      </div>

      <form className="border-top p-3 flex-shrink-0" onSubmit={(e) => void handleSend(e)}>
        <div className="mb-2">
          <label className="form-label small mb-1" htmlFor="lead-email-to">
            To
          </label>
          <input
            id="lead-email-to"
            className="form-control form-control-sm"
            value={hasEmail ? to : ""}
            placeholder={hasEmail ? undefined : "—"}
            readOnly
            disabled
          />
        </div>
        <div className="mb-2">
          <label className="form-label small mb-1" htmlFor="lead-email-subject">
            Objet
          </label>
          <input
            id="lead-email-subject"
            className="form-control form-control-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={composerDisabled}
            placeholder="Objet"
          />
        </div>
        <div className="mb-2">
          <label className="form-label small mb-1" htmlFor="lead-email-body">
            Message
          </label>
          <textarea
            id="lead-email-body"
            className="form-control"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={composerDisabled}
            placeholder={hasEmail ? "Écrire un email…" : "Ce lead n'a pas d'email"}
          />
        </div>
        {sendError ? (
          <div className="alert alert-danger py-2 small" role="alert">
            {sendError}
          </div>
        ) : null}
        {!hasEmail ? (
          <small className="text-muted d-block mb-2">Ce lead n&apos;a pas d&apos;email</small>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={composerDisabled || !subject.trim() || !body.trim()}
        >
          {sending ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" />
              Envoi…
            </>
          ) : (
            "Envoyer"
          )}
        </button>
      </form>
    </div>
  );
}
