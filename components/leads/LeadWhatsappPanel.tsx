"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ApiError } from "@/lib/api/client";
import { getLeadWhatsappThread } from "@/lib/api/leads";
import {
  isWhatsapp24hError,
  sendMessage,
  type WhatsappConversation,
  type WhatsappMessage,
} from "@/lib/api/whatsapp";
import { WhatsappMessageBubble } from "@/components/whatsapp/WhatsappMessageBubble";

const REFRESH_MS = 15_000;

type Props = {
  leadId: string;
  onToast?: (message: string, variant: "success" | "danger" | "info") => void;
};

function upsertById(list: WhatsappMessage[], msg: WhatsappMessage): WhatsappMessage[] {
  const idx = list.findIndex((m) => m.id === msg.id);
  if (idx < 0) return [...list, msg];
  const next = list.slice();
  next[idx] = msg;
  return next;
}

export function LeadWhatsappPanel({ leadId, onToast }: Props) {
  const [conversation, setConversation] = useState<WhatsappConversation | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<WhatsappMessage | null>(null);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const loadThread = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!leadId) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await getLeadWhatsappThread(leadId);
        setConversation(res.conversation);
        setMessages(Array.isArray(res.messages) ? res.messages : []);
      } catch (err) {
        if (!opts?.silent) {
          setError(err instanceof ApiError ? err.message : "Impossible de charger le thread WhatsApp.");
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!leadId) return;
    const timer = window.setInterval(() => {
      void loadThread({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [leadId, loadThread]);

  useEffect(() => {
    if (loading || !stickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom(false));
  }, [messages, loading, scrollToBottom]);

  function onScroll() {
    const el = bodyRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!conversation?.id || sending) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      const created = await sendMessage(conversation.id, {
        text,
        replyToMessageId: replyTo?.id,
      });
      setMessages((prev) => upsertById(prev, created));
      setDraft("");
      setReplyTo(null);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
      void loadThread({ silent: true });
    } catch (err) {
      if (isWhatsapp24hError(err)) {
        onToast?.(
          "Fenêtre 24h fermée — le lead doit écrire, ou utilisez un template depuis l’inbox WhatsApp.",
          "info",
        );
      } else {
        onToast?.(err instanceof ApiError ? err.message : "Envoi impossible.", "danger");
      }
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canCompose = Boolean(conversation?.id);

  return (
    <div className="lead-wa-panel d-flex flex-column h-100">
      {loading ? (
        <div className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement…</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center gap-2 p-4 text-center">
          <p className="text-danger mb-0">{error}</p>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void loadThread()}>
            Réessayer
          </button>
        </div>
      ) : !conversation ? (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center gap-2 p-4 text-center">
          <i className="fab fa-whatsapp fs-2 text-muted" aria-hidden />
          <p className="mb-0 text-muted">Aucune conversation WhatsApp avec ce lead.</p>
        </div>
      ) : (
        <div className="chat-conversation flex-grow-1 px-3" ref={bodyRef} onScroll={onScroll}>
          {messages.length === 0 ? (
            <div className="text-center text-muted py-5">Aucun message pour le moment.</div>
          ) : (
            messages.map((m) => (
              <WhatsappMessageBubble
                key={m.id}
                message={m}
                onReply={(msg) => setReplyTo(msg)}
              />
            ))
          )}
        </div>
      )}

      <div className="lead-wa-panel__composer border-top p-3 flex-shrink-0">
        {replyTo ? (
          <div className="d-flex align-items-start justify-content-between gap-2 mb-2 small bg-light rounded px-2 py-1">
            <div className="text-truncate">
              <strong className="d-block">Réponse</strong>
              <span className="text-muted">{replyTo.body || "…"}</span>
            </div>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-muted"
              aria-label="Annuler la réponse"
              onClick={() => setReplyTo(null)}
            >
              <i className="fi fi-rr-cross-small" />
            </button>
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSend(e)} className="d-flex gap-2 align-items-end">
          <textarea
            className="form-control"
            rows={2}
            placeholder={
              canCompose
                ? "Écrire un message…"
                : "Le lead doit d'abord écrire, ou utilisez un template."
            }
            value={draft}
            disabled={!canCompose || sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <button
            type="submit"
            className="btn btn-primary flex-shrink-0"
            disabled={!canCompose || sending || !draft.trim()}
            title="Envoyer"
          >
            {sending ? (
              <span className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <i className="fi fi-rr-paper-plane-top" aria-hidden />
            )}
          </button>
        </form>
        {!canCompose && !loading && !error ? (
          <small className="text-muted d-block mt-2">
            Le lead doit d&apos;abord écrire, ou utilisez un template.
          </small>
        ) : null}
      </div>
    </div>
  );
}
