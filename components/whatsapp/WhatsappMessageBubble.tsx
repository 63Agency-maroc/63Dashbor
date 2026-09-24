"use client";

import { useEffect, useState } from "react";
import type { WhatsappMessage } from "@/lib/api/whatsapp";
import { formatInCasablanca } from "@/lib/datetime/casablanca";
import { getMediaMeta } from "@/lib/api/whatsapp";
import { WhatsappAudioPlayer } from "@/components/whatsapp/WhatsappAudioPlayer";

type Props = {
  message: WhatsappMessage;
  onReply: (message: WhatsappMessage) => void;
};

function StatusTicks({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "failed") return <i className="fi fi-rr-cross-small text-danger ms-1" title="failed" />;
  if (s === "read") return <i className="fi fi-rr-check-double text-primary ms-1" title="read" />;
  if (s === "delivered") return <i className="fi fi-rr-check-double text-muted ms-1" title="delivered" />;
  if (s === "sent") return <i className="fi fi-rr-check text-muted ms-1" title="sent" />;
  return null;
}

function ImageBlock({ message }: { message: WhatsappMessage }) {
  const [url, setUrl] = useState(message.mediaUrl);
  useEffect(() => {
    if (message.mediaUrl) {
      setUrl(message.mediaUrl);
      return;
    }
    if (!message.mediaId) return;
    let cancelled = false;
    void getMediaMeta(message.mediaId)
      .then((m) => {
        if (!cancelled) setUrl(m.url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [message.mediaUrl, message.mediaId]);

  if (!url) return <span className="spinner-border spinner-border-sm text-muted" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={message.fileName || "image"} />
  );
}

/** Normalise type API (casse / alias voice|ptt) */
function normalizeMessageType(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function pickMediaUrl(message: WhatsappMessage): string | null {
  const direct = message.mediaUrl?.trim();
  if (direct) return direct;
  // Défense si payload snake_case non mappé
  const extra = message as WhatsappMessage & { media_url?: string | null };
  const snake = extra.media_url?.trim();
  return snake || null;
}

function pickMediaId(message: WhatsappMessage): string | null {
  const direct = message.mediaId?.trim();
  if (direct) return direct;
  const extra = message as WhatsappMessage & { media_id?: string | null };
  const snake = extra.media_id?.trim();
  return snake || null;
}

export function WhatsappMessageBubble({ message, onReply }: Props) {
  const isOut = message.direction === "outbound";
  const cls = isOut ? "chat-message-right" : "chat-message-left";
  const time = formatInCasablanca(message.createdAt, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const type = normalizeMessageType(message.type);
  const isAudio = type === "audio" || type === "voice" || type === "ptt" || type === "audio/ogg";
  const mediaUrl = pickMediaUrl(message);
  const mediaId = pickMediaId(message);
  const bodyText = (message.body ?? "").trim();
  // Placeholder backend "Audio" — ne pas afficher à côté du lecteur
  const showBody = Boolean(bodyText) && !(isAudio && /^audio$/i.test(bodyText));

  return (
    <div className={cls}>
      {message.replyTo ? (
        <div className="chat-message-text wa-reply-quote border-start border-3 border-primary">
          <strong className="d-block">{message.replyTo.authorLabel || "Reply"}</strong>
          <span className="text-truncate d-block">{message.replyTo.body || "…"}</span>
        </div>
      ) : null}

      <div className="chat-message-text">
        {type === "image" && (mediaUrl || mediaId) ? (
          <div className="wa-media">
            <ImageBlock message={{ ...message, mediaUrl, mediaId }} />
          </div>
        ) : null}

        {type === "video" && mediaUrl ? (
          <video src={mediaUrl} controls className="wa-media mb-0" />
        ) : null}

        {type === "document" && mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noreferrer" className="d-inline-flex align-items-center gap-1">
            <i className="fi fi-rr-file" />
            {message.fileName || "Document"}
          </a>
        ) : null}

        {isAudio ? (
          <div className="wa-media wa-audio-wrap">
            {mediaUrl || mediaId ? (
              <WhatsappAudioPlayer
                mediaUrl={mediaUrl}
                mediaId={mediaId}
                variant={isOut ? "outbound" : "inbound"}
              />
            ) : (
              <span className="small text-danger">Audio indisponible</span>
            )}
          </div>
        ) : null}

        {showBody ? <div style={{ whiteSpace: "pre-wrap" }}>{bodyText}</div> : null}

        {!showBody && !isAudio && !["image", "video", "document"].includes(type) ? (
          <div className="text-muted" style={{ fontSize: "0.8em" }}>
            [{message.type || "message"}]
          </div>
        ) : null}
      </div>

      <div className="chat-time d-flex align-items-center gap-1">
        <span>{time}</span>
        {isOut ? <StatusTicks status={String(message.status || "")} /> : null}
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-muted"
          title="Répondre"
          onClick={() => onReply(message)}
        >
          <i className="fi fi-rr-reply-all" />
        </button>
      </div>
    </div>
  );
}
