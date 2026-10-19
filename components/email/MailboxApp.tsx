"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import DOMPurify from "isomorphic-dompurify";
import { ApiError } from "@/lib/api/client";
import {
  getMessage,
  isMailboxDisconnected,
  listFolders,
  listMessages,
  markSeen,
  replyMail,
  sendMail,
  type MailFolder,
  type MailListItem,
  type MailMessage,
} from "@/lib/api/mailbox";
import { AppToast } from "@/components/clients/AppToast";
import { CASABLANCA_TZ, formatDate, formatDateTime, formatTime, parseIso, toYmdInZone } from "@/lib/utils/date";

const PAGE_SIZE = 50;

type FolderView = {
  label: string;
  icon: string;
  order: number;
};

const FOLDER_VIEWS: { test: (folder: MailFolder) => boolean; view: FolderView }[] = [
  {
    test: (f) => matchUse(f, "inbox") || f.name.toLowerCase() === "inbox" || f.id.toLowerCase() === "inbox",
    view: { label: "Inbox", icon: "fi fi-rr-inbox-in", order: 0 },
  },
  {
    test: (f) => matchUse(f, "sent") || /sent/i.test(f.name),
    view: { label: "Sent", icon: "fi fi-rr-paper-plane-top", order: 1 },
  },
  {
    test: (f) => matchUse(f, "draft") || /draft/i.test(f.name),
    view: { label: "Drafts", icon: "fi fi-rr-blueprint", order: 2 },
  },
  {
    test: (f) => matchUse(f, "trash") || /trash|deleted/i.test(f.name),
    view: { label: "Trash", icon: "fi fi-rr-trash", order: 3 },
  },
  {
    test: (f) => matchUse(f, "flag") || matchUse(f, "star") || /star/i.test(f.name),
    view: { label: "Starred", icon: "fi fi-rr-star", order: 4 },
  },
  {
    test: (f) => matchUse(f, "junk") || matchUse(f, "spam") || /spam|junk/i.test(f.name),
    view: { label: "Spam", icon: "fi fi-rr-square-info", order: 5 },
  },
  {
    test: (f) => matchUse(f, "archive") || /archive/i.test(f.name),
    view: { label: "Archive", icon: "fi fi-rr-box", order: 6 },
  },
  {
    test: (f) => /schedul/i.test(f.name) || matchUse(f, "schedul"),
    view: { label: "Scheduled", icon: "fi fi-rr-calendar", order: 7 },
  },
];

function matchUse(folder: MailFolder, token: string) {
  return (folder.specialUse ?? "").toLowerCase().includes(token);
}

function folderView(folder: MailFolder): FolderView {
  return (
    FOLDER_VIEWS.find((entry) => entry.test(folder))?.view ?? {
      label: folder.name || folder.id,
      icon: "fi fi-rr-folder",
      order: 20,
    }
  );
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function parseAddress(raw: string): { name: string; email: string } {
  const value = raw.trim();
  const angled = value.match(/^(.*)<([^>]+)>\s*$/);
  if (angled) {
    return {
      name: angled[1].replace(/"/g, "").trim() || angled[2].trim(),
      email: angled[2].trim(),
    };
  }
  if (value.includes("@")) return { name: value, email: value };
  return { name: value || "—", email: "" };
}

function formatListDate(iso: string): string {
  const d = parseIso(iso);
  if (!d) return iso || "—";
  const today = toYmdInZone(new Date(), CASABLANCA_TZ);
  const day = toYmdInZone(d, CASABLANCA_TZ);
  return day === today ? formatTime(iso, CASABLANCA_TZ) : formatDate(iso, CASABLANCA_TZ);
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function splitEmails(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function replySubject(subject: string): string {
  const s = subject.trim();
  if (/^re:/i.test(s)) return s;
  return `Re: ${s || "(sans objet)"}`;
}

function quoteText(message: MailMessage): string {
  const original = (message.text || "").trim();
  const header = `\n\n----------\n${message.from} a écrit :\n`;
  const quoted = original
    ? original
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
    : "";
  return `${header}${quoted}`;
}

export function MailboxApp() {
  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" | "info" } | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MailListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [ccDraft, setCcDraft] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [replying, setReplying] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubjectValue, setReplySubjectValue] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  const fail = useCallback((err: unknown, fallback: string) => {
    if (isMailboxDisconnected(err)) {
      setDisconnected(true);
      return true;
    }
    setToast({
      message: err instanceof ApiError ? err.message : fallback,
      variant: "danger",
    });
    return false;
  }, []);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFoldersError(null);
    try {
      const list = await listFolders();
      setFolders(list);
      setFolderId((current) => {
        if (current && list.some((f) => f.id === current)) return current;
        const inbox =
          list.find((f) => folderView(f).label === "Inbox") ?? list[0];
        return inbox?.id ?? "";
      });
    } catch (err) {
      if (!fail(err, "Impossible de charger les dossiers.")) {
        setFoldersError(err instanceof ApiError ? err.message : "Impossible de charger les dossiers.");
      }
    } finally {
      setFoldersLoading(false);
    }
  }, [fail]);

  const loadList = useCallback(async () => {
    if (!folderId || disconnected) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await listMessages({ folder: folderId, page, limit: PAGE_SIZE, search });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (!fail(err, "Impossible de charger les messages.")) {
        setListError(err instanceof ApiError ? err.message : "Impossible de charger les messages.");
        setItems([]);
        setTotal(0);
      }
    } finally {
      setListLoading(false);
    }
  }, [folderId, page, search, disconnected, fail]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const orderedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        const diff = folderView(a).order - folderView(b).order;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }),
    [folders],
  );

  const rangeLabel = useMemo(() => {
    if (total <= 0 || items.length === 0) return "0";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = start + items.length - 1;
    return `${start} - ${end} of ${total}`;
  }, [items.length, page, total]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCompose() {
    setComposing(true);
    setReplying(false);
    setComposeTo("");
    setComposeCc("");
    setToDraft("");
    setCcDraft("");
    setComposeSubject("");
    setComposeBody("");
    setComposeError(null);
  }

  function selectFolder(id: string) {
    setFolderId(id);
    setPage(1);
    setSelectedUid(null);
    setMessage(null);
    setComposing(false);
    setReplying(false);
  }

  async function openMessage(item: MailListItem) {
    if (!folderId) return;
    setComposing(false);
    setReplying(false);
    setSelectedUid(item.uid);
    setMessage(null);
    setMessageLoading(true);
    setMessageError(null);
    try {
      const full = await getMessage(item.uid, folderId);
      setMessage(full);
      if (!item.seen) {
        try {
          await markSeen(item.uid, folderId);
          setItems((prev) => prev.map((row) => (row.uid === item.uid ? { ...row, seen: true } : row)));
          setFolders((prev) =>
            prev.map((folder) =>
              folder.id === folderId
                ? { ...folder, unseen: Math.max(0, folder.unseen - 1) }
                : folder,
            ),
          );
          setMessage((current) => (current && current.uid === item.uid ? { ...current, seen: true } : current));
        } catch (err) {
          fail(err, "Impossible de marquer le message comme lu.");
        }
      }
    } catch (err) {
      if (!fail(err, "Impossible d’ouvrir le message.")) {
        setMessageError(err instanceof ApiError ? err.message : "Impossible d’ouvrir le message.");
      }
    } finally {
      setMessageLoading(false);
    }
  }

  function startReply() {
    if (!message) return;
    const from = parseAddress(message.from);
    setReplying(true);
    setReplyTo(from.email || message.from);
    setReplySubjectValue(replySubject(message.subject));
    setReplyBody(quoteText(message));
    setReplyError(null);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const to = [...splitEmails(composeTo), toDraft.trim()].filter(Boolean).join(", ");
    const subject = composeSubject.trim();
    const body = composeBody.trim();
    if (!to || !subject || !body) {
      setComposeError("Destinataire, objet et message sont requis.");
      return;
    }
    setSending(true);
    setComposeError(null);
    try {
      await sendMail({ to, subject, bodyText: body, bodyHtml: textToHtml(body) });
      setToast({ message: "Message envoyé.", variant: "success" });
      setComposing(false);
      setComposeTo("");
      setComposeCc("");
      setToDraft("");
      setCcDraft("");
      setComposeSubject("");
      setComposeBody("");
      void loadList();
    } catch (err) {
      if (!fail(err, "Envoi impossible.")) {
        setComposeError(err instanceof ApiError ? err.message : "Envoi impossible.");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!message || !folderId || sending) return;
    const body = replyBody.trim();
    if (!body) {
      setReplyError("Le message est requis.");
      return;
    }
    setSending(true);
    setReplyError(null);
    try {
      await replyMail(message.uid, {
        folder: folderId,
        bodyText: body,
        bodyHtml: textToHtml(body),
      });
      setToast({ message: "Réponse envoyée.", variant: "success" });
      setReplying(false);
      void loadList();
    } catch (err) {
      if (!fail(err, "Réponse impossible.")) {
        setReplyError(err instanceof ApiError ? err.message : "Réponse impossible.");
      }
    } finally {
      setSending(false);
    }
  }

  const safeBody = message?.html
    ? sanitizeHtml(message.html)
    : message?.text
      ? textToHtml(message.text)
      : "";

  return (
    <div className={`container-fluid mailbox-page${selectedUid ? " is-reading" : ""}${composing ? " is-composing" : ""}`}>
      <style>{`
        .mailbox-page { max-width: 100%; overflow-x: hidden; }
        .mailbox-page .mb-shell {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 0;
          height: calc(100vh - 168px);
          min-height: 480px;
          max-width: 100%;
          overflow: hidden;
          background: var(--bs-body-bg);
          border: 1px solid var(--bs-border-color);
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        [data-bs-theme="dark"] .mailbox-page .mb-shell {
          background: var(--bs-secondary-bg);
          box-shadow: none;
        }
        .mailbox-page .mb-folders {
          position: static;
          flex: 0 0 248px;
          width: 248px;
          max-width: 248px;
          align-self: stretch;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: var(--bs-light);
          border: 0;
          overflow: hidden;
          padding: 16px 12px 12px;
        }
        [data-bs-theme="dark"] .mailbox-page .mb-folders {
          background: var(--bs-tertiary-bg);
        }
        .mailbox-page .mb-compose-btn {
          flex: 0 0 auto;
          font-weight: 600;
          border-radius: 10px;
          padding: 0.62rem 1rem;
          margin-bottom: 10px;
        }
        .mailbox-page .mb-folder-card {
          flex: 1 1 auto;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 4px 0 0;
          background: transparent;
          border: 0;
          box-shadow: none;
        }
        .mailbox-page .mb-folder {
          width: 100%;
          min-height: 42px;
          border: 0;
          background: transparent;
          color: var(--bs-heading-color);
          border-radius: 10px;
          padding: 0 12px;
          margin: 2px 0;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
        }
        .mailbox-page .mb-folder i { font-size: 18px; color: var(--bs-secondary-color); }
        .mailbox-page .mb-folder span { min-width: 0; }
        .mailbox-page .mb-folder:hover { background: rgba(255, 255, 255, 0.55); }
        [data-bs-theme="dark"] .mailbox-page .mb-folder:hover { background: rgba(255, 255, 255, 0.04); }
        .mailbox-page .mb-folder.is-active {
          background: var(--bs-body-bg);
          color: var(--bs-heading-color);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04);
        }
        [data-bs-theme="dark"] .mailbox-page .mb-folder.is-active {
          background: var(--bs-secondary-bg);
          box-shadow: none;
        }
        .mailbox-page .mb-folder.is-active i { color: var(--bs-primary); }
        .mailbox-page .mb-folder .badge { font-weight: 600; font-size: 11px; }
        .mailbox-page .mb-main {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .mailbox-page .mb-toolbar {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 14px 16px 10px;
          border-bottom: 0;
          min-width: 0;
          background: transparent;
        }
        .mailbox-page .mb-search {
          flex: 0 1 280px;
          min-width: 0;
          max-width: 320px;
        }
        .mailbox-page .mb-search .form-control {
          border-radius: 8px;
          background: var(--bs-body-bg);
        }
        .mailbox-page .mb-list-tools {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 8px 18px;
          background: var(--bs-light);
          border-top: 1px solid var(--bs-border-color);
          border-bottom: 1px solid var(--bs-border-color);
          color: var(--bs-secondary-color);
        }
        [data-bs-theme="dark"] .mailbox-page .mb-list-tools {
          background: rgba(255, 255, 255, 0.03);
        }
        .mailbox-page .mb-folder-select { display: none; }
        .mailbox-page .mb-compose-toolbar { display: none; }
        .mailbox-page .mb-panes {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(0, 1fr);
          overflow: hidden;
        }
        .mailbox-page.is-reading .mb-panes {
          grid-template-columns: minmax(280px, 46%) minmax(0, 1fr);
        }
        .mailbox-page.is-composing .mb-panes {
          grid-template-columns: minmax(0, 1fr);
        }
        .mailbox-page.is-composing .mb-list,
        .mailbox-page.is-composing .mb-read,
        .mailbox-page.is-composing .mb-list-tools { display: none; }
        .mailbox-page.is-composing .mb-compose-layer {
          grid-column: 1;
          background: var(--bs-body-bg);
        }
        .mailbox-page .mb-list,
        .mailbox-page .mb-read {
          min-width: 0;
          min-height: 0;
        }
        .mailbox-page .mb-list {
          grid-column: 1;
          grid-row: 1;
          overflow-x: hidden;
          overflow-y: auto;
          border-right: 0;
        }
        .mailbox-page.is-reading .mb-list { border-right: 1px solid var(--bs-border-color); }
        .mailbox-page .mb-read {
          grid-column: 2;
          grid-row: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: var(--bs-body-bg);
        }
        .mailbox-page .mb-read-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .mailbox-page .mb-read-actions {
          flex: 0 0 auto;
          border-top: 1px solid var(--bs-border-color);
          padding: 12px 16px;
          background: var(--bs-body-bg);
        }
        .mailbox-page .mail-list { height: auto !important; max-height: none; }
        .mailbox-page .mail-list-item { min-width: 0; max-width: 100%; }
        .mailbox-page .mail-list-item .mail-item-content {
          width: auto;
          flex: 1 1 auto;
          min-width: 0;
        }
        .mailbox-page .mail-list-item .mail-item-username {
          width: auto;
          min-width: 0;
          max-width: 34%;
        }
        .mailbox-page .mail-list-item .mail-item-subject,
        .mailbox-page .mail-list-item .mail-item-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mailbox-page .mail-list-item .mail-item-meta { flex: 0 0 auto; }
        .mailbox-page .mail-list-item.is-active {
          background: rgba(var(--bs-primary-rgb), 0.08);
        }
        .mailbox-page .mail-list-item.mail-unread .mail-item-username,
        .mailbox-page .mail-list-item.mail-unread .mail-item-subject {
          font-weight: 700;
        }
        .mailbox-page .mail-html { overflow-wrap: anywhere; word-break: break-word; }
        .mailbox-page .mail-html img { max-width: 100%; height: auto; }
        .mailbox-page .mail-html a { color: var(--bs-primary); }
        .mailbox-page .mb-compose-layer { display: none; }
        .mailbox-page.is-reading .mb-read { display: flex; }
        .mailbox-page.is-composing .mb-compose-layer {
          display: flex;
          flex-direction: column;
          grid-column: 1;
          grid-row: 1;
          min-width: 0;
          min-height: 0;
          background: var(--bs-body-bg);
        }
        .mailbox-page.is-composing .mb-read { display: none; }
        .mailbox-page .mb-compose-card {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          width: 100%;
          background: var(--bs-body-bg);
        }
        .mailbox-page .mb-compose-card .mail-textarea {
          flex: 1 1 auto;
          min-height: 160px;
          height: auto;
        }
        .mailbox-page .mb-fab { display: none; }
        .mailbox-page .mb-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-height: 52px;
          padding: 10px 18px;
          border: 0;
          border-bottom: 1px solid var(--bs-border-color);
          background: transparent;
          text-align: left;
          cursor: pointer;
          min-width: 0;
        }
        .mailbox-page .mb-row:hover { background: rgba(var(--bs-primary-rgb), 0.05); }
        .mailbox-page .mb-row.is-active { background: rgba(var(--bs-primary-rgb), 0.1); }
        .mailbox-page .mb-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 8px;
          background: transparent;
        }
        .mailbox-page .mb-row.is-unread .mb-dot { background: var(--bs-primary); }
        .mailbox-page .mb-row-main { flex: 1 1 auto; min-width: 0; }
        .mailbox-page .mb-row-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }
        .mailbox-page .mb-sender {
          flex: 0 0 132px;
          max-width: 28%;
          font-weight: 500;
          color: var(--bs-heading-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mailbox-page .mb-subject {
          flex: 0 1 auto;
          max-width: 42%;
          font-weight: 600;
          color: var(--bs-heading-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mailbox-page .mb-preview {
          flex: 1 1 auto;
          min-width: 0;
          color: var(--bs-secondary-color);
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mailbox-page .mb-row.is-unread .mb-sender,
        .mailbox-page .mb-row.is-unread .mb-subject { font-weight: 700; }
        .mailbox-page .mb-time {
          flex: 0 0 auto;
          color: var(--bs-secondary-color);
          font-size: 12px;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .mailbox-page .mb-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(var(--bs-primary-rgb), 0.12);
          color: var(--bs-primary);
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
          max-width: 180px;
        }
        .mailbox-page .mb-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mailbox-page .mb-chips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
          padding: 6px 0;
        }
        @media (max-width: 1279.98px) and (min-width: 1024px) {
          .mailbox-page .mb-folders {
            flex-basis: 220px;
            width: 220px;
            max-width: 220px;
          }
          .mailbox-page.is-reading .mb-panes {
            grid-template-columns: minmax(240px, 42%) minmax(0, 1fr);
          }
        }
        @media (max-width: 1023.98px) {
          .mailbox-page .mb-shell {
            flex-direction: column;
            height: calc(100vh - 140px);
          }
          .mailbox-page .mb-folders { display: none; }
          .mailbox-page .mb-folder-select {
            display: block;
            width: 148px;
            max-width: 42vw;
          }
          .mailbox-page .mb-panes {
            display: flex;
            flex-direction: column;
          }
          .mailbox-page .mb-list {
            flex: 1 1 auto;
            width: 100%;
            border-right: 0;
          }
          .mailbox-page .mb-read {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 1040;
            width: 100%;
            background: var(--bs-body-bg);
          }
          .mailbox-page.is-reading .mb-read { display: flex; }
          .mailbox-page.is-reading .mb-list { display: none; }
          .mailbox-page.is-composing .mb-read { display: none; }
          .mailbox-page.is-composing .mb-compose-layer {
            position: fixed;
            inset: 0;
            z-index: 1060;
            grid-column: auto;
            background: var(--bs-body-bg);
          }
          .mailbox-page .mb-compose-card {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
          .mailbox-page .mb-fab {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            position: fixed;
            right: 16px;
            bottom: 16px;
            z-index: 1035;
            border-radius: 999px;
            padding: 12px 18px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          }
          .mailbox-page .mail-list-item .mail-item-username { max-width: 42%; }
        }
      `}</style>

      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link href="/">
                <i className="fi fi-rr-home" /> Home
              </Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Inbox
            </li>
          </ol>
        </nav>
      </div>

      {disconnected ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="fi fi-rr-envelope fs-2 text-muted d-block mb-2" aria-hidden />
            <p className="mb-3">Connectez votre boîte mail pour envoyer des emails</p>
            <Link href="/settings?tab=integrations" className="btn btn-primary btn-sm">
              Intégrations
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-shell">
            <aside className="mb-folders">
              <button type="button" className="btn btn-primary waves-effect waves-light w-100 mb-compose-btn" onClick={openCompose}>
                Compose
              </button>
              <div className="mb-folder-card" role="tablist">
                {foldersLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  </div>
                ) : foldersError ? (
                  <p className="small text-danger px-2 mb-0">{foldersError}</p>
                ) : orderedFolders.length === 0 ? (
                  <p className="small text-muted px-2 mb-0">Aucun dossier.</p>
                ) : (
                  orderedFolders.map((folder) => {
                    const view = folderView(folder);
                    const active = folder.id === folderId;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        className={`mb-folder${active ? " is-active" : ""}`}
                        onClick={() => selectFolder(folder.id)}
                      >
                        <i className={view.icon} aria-hidden />
                        <span className="text-truncate">{view.label}</span>
                        {folder.unseen > 0 ? (
                          <span className="badge rounded-pill bg-primary-subtle text-primary ms-auto">
                            {folder.unseen}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <div className="mb-main">
              <div className="mb-toolbar">
                <select
                  className="form-select form-select-sm mb-folder-select"
                  aria-label="Dossier"
                  value={folderId}
                  onChange={(e) => selectFolder(e.target.value)}
                >
                  {orderedFolders.map((folder) => {
                    const view = folderView(folder);
                    const count = folder.unseen > 0 ? ` (${folder.unseen})` : "";
                    return (
                      <option key={folder.id} value={folder.id}>
                        {view.label}
                        {count}
                      </option>
                    );
                  })}
                </select>
                <button type="button" className="btn btn-primary btn-sm mb-compose-toolbar" onClick={openCompose}>
                  Nouveau message ✉️
                </button>
                <form
                  className="d-flex align-items-center position-relative mb-search"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <i className="fi fi-rr-search position-absolute start-0 ms-3" aria-hidden />
                  <input
                    type="search"
                    className="form-control ps-5"
                    placeholder="Search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </form>
                <div className="d-flex align-items-center gap-3 ms-auto">
                  <span className="small text-nowrap text-body">{rangeLabel}</span>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-white btn-shadow btn-icon waves-effect"
                      disabled={page <= 1 || listLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Page précédente"
                    >
                      <i className="fi fi-rr-angle-left text-2xs" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-white btn-shadow btn-icon waves-effect"
                      disabled={page >= pageCount || listLoading}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Page suivante"
                    >
                      <i className="fi fi-rr-angle-right text-2xs" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-list-tools">
                <button
                  type="button"
                  className="btn btn-link p-0 text-body"
                  onClick={() => void loadList()}
                  aria-label="Actualiser"
                  disabled={listLoading}
                >
                  <i className="fi fi-rr-rotate-right" />
                </button>
              </div>

              <div className="mb-panes">
                <div className="mb-list">
                  {listLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status" />
                    </div>
                  ) : listError ? (
                    <div className="text-center py-5">
                      <p className="text-danger">{listError}</p>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void loadList()}>
                        Réessayer
                      </button>
                    </div>
                  ) : items.length === 0 ? (
                    <p className="text-center text-muted py-5 mb-0">Aucun message.</p>
                  ) : (
                    <ul className="list-unstyled m-0">
                      {items.map((item) => (
                        <li key={item.uid}>
                          <button
                            type="button"
                            className={`mb-row${item.seen ? "" : " is-unread"}${item.uid === selectedUid ? " is-active" : ""}`}
                            onClick={() => void openMessage(item)}
                          >
                            <span className="mb-row-main">
                              <span className="mb-row-line">
                                <span className="mb-sender">{parseAddress(item.from).name}</span>
                                <span className="mb-subject">{item.subject}</span>
                                {item.snippet ? <span className="mb-preview">{item.snippet}</span> : null}
                              </span>
                            </span>
                            <span className="mb-time">
                              {item.hasAttachments ? <i className="fi fi-rr-clip" title="Pièce jointe" /> : null}
                              {formatListDate(item.date)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mb-read">
                  {!selectedUid ? (
                    <div className="mb-read-placeholder d-flex flex-grow-1 align-items-center justify-content-center text-muted p-4">
                      Sélectionnez un message
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center gap-2 border-bottom px-3 py-2 flex-shrink-0">
                        <button
                          type="button"
                          className="btn btn-white btn-shadow btn-icon waves-effect"
                          onClick={() => {
                            setSelectedUid(null);
                            setMessage(null);
                            setReplying(false);
                          }}
                          aria-label="Retour à la liste"
                        >
                          <i className="fi fi-rr-arrow-left" />
                        </button>
                        <span className="small text-muted text-truncate">Message</span>
                      </div>
                      {messageLoading ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" role="status" />
                        </div>
                      ) : messageError ? (
                        <p className="text-danger text-center py-4">{messageError}</p>
                      ) : message ? (
                        <>
                          <div className="mb-read-scroll">
                            <div className="border-bottom p-sm-4 p-3">
                              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                                <h4 className="mb-0 text-break">{message.subject}</h4>
                                <small className="text-nowrap">{formatDateTime(message.date, CASABLANCA_TZ)}</small>
                              </div>
                              <div className="d-flex align-items-center gap-2 min-w-0">
                                <div className="avatar avatar-sm bg-primary text-white bg-opacity-10 rounded-circle fw-bold flex-shrink-0">
                                  {(parseAddress(message.from).name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="d-flex flex-wrap align-items-center">
                                    <h6 className="mb-0 me-2">{parseAddress(message.from).name}</h6>
                                    <span className="small text-muted text-break">{parseAddress(message.from).email}</span>
                                  </div>
                                  <div className="small text-muted text-break">
                                    <span className="me-1">To:</span>
                                    <span>{message.to || "—"}</span>
                                    {message.cc ? <span className="ms-2">CC: {message.cc}</span> : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div
                              className="mail-html text-dark p-sm-4 p-3"
                              dangerouslySetInnerHTML={{ __html: safeBody || "<p>—</p>" }}
                            />
                            {message.attachments.length > 0 ? (
                              <div className="px-sm-4 px-3 pb-3">
                                <h5 className="mb-2 fw-semibold">Attachment</h5>
                                <div className="p-3 bg-light rounded-2">
                                  <ul className="list-unstyled mb-0">
                                    {message.attachments.map((file) => (
                                      <li key={`${file.filename}-${file.size ?? 0}`} className="d-flex align-items-center gap-2 py-1 min-w-0">
                                        <i className="fi fi-rr-clip flex-shrink-0" />
                                        <span className="text-truncate">{file.filename}</span>
                                        {file.size != null ? (
                                          <small className="text-muted flex-shrink-0">{Math.ceil(file.size / 1024)} Ko</small>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ) : null}
                            {replying ? (
                              <form className="px-sm-4 px-3 pb-4" onSubmit={(e) => void handleReply(e)}>
                                {replyError ? (
                                  <div className="alert alert-danger py-2" role="alert">
                                    {replyError}
                                  </div>
                                ) : null}
                                <ul className="list-group list-group-flush border-bottom mb-2">
                                  <li className="list-group-item d-flex align-items-center px-0 py-0">
                                    <span className="text-body minw-100px">To</span>
                                    <input className="form-control border-0 shadow-none px-2" value={replyTo} readOnly />
                                  </li>
                                  <li className="list-group-item d-flex align-items-center px-0 py-2">
                                    <span className="text-body minw-100px">Subject</span>
                                    <input className="form-control border-0 shadow-none text-dark" value={replySubjectValue} readOnly />
                                  </li>
                                </ul>
                                <textarea
                                  className="form-control mb-2"
                                  rows={6}
                                  value={replyBody}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  disabled={sending}
                                />
                                <div className="d-flex gap-2">
                                  <button type="submit" className="btn btn-primary" disabled={sending}>
                                    {sending ? "Envoi…" : "Envoyer"}
                                  </button>
                                  <button type="button" className="btn btn-light" disabled={sending} onClick={() => setReplying(false)}>
                                    Annuler
                                  </button>
                                </div>
                              </form>
                            ) : null}
                          </div>
                          {!replying ? (
                            <div className="mb-read-actions">
                              <button type="button" className="btn btn-primary" onClick={startReply}>
                                <i className="fi fi-rr-reply-all me-2" aria-hidden />
                                Répondre
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="mb-compose-layer" role="dialog" aria-modal="true" aria-label="Nouveau message">
                  <form className="mb-compose-card" onSubmit={(e) => void handleSend(e)}>
                    <div className="d-flex align-items-center gap-2 border-bottom px-3 py-2">
                      <h6 className="mb-0 me-auto">Nouveau message</h6>
                      <button
                        type="button"
                        className="btn btn-white btn-shadow btn-icon waves-effect"
                        onClick={() => setComposing(false)}
                        aria-label="Fermer"
                      >
                        <i className="fi fi-rr-cross-small" />
                      </button>
                    </div>
                    <div className="px-4 py-3">
                      {composeError ? (
                        <div className="alert alert-danger py-2" role="alert">
                          {composeError}
                        </div>
                      ) : null}
                      <ul className="list-group list-group-flush border-bottom">
                        <li className="list-group-item d-flex align-items-center px-0 py-1 bg-transparent">
                          <span className="text-body minw-100px">To</span>
                          <div className="mb-chips">
                            {splitEmails(composeTo).map((email) => (
                              <span className="mb-chip" key={email}>
                                <span>{email}</span>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-primary"
                                  aria-label={`Retirer ${email}`}
                                  onClick={() =>
                                    setComposeTo(splitEmails(composeTo).filter((item) => item !== email).join(", "))
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              className="form-control border-0 shadow-none px-1 flex-grow-1"
                              style={{ minWidth: 120 }}
                              value={toDraft}
                              placeholder="email@exemple.com"
                              disabled={sending}
                              onChange={(e) => setToDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "," || e.key === ";") {
                                  e.preventDefault();
                                  const next = toDraft.trim().replace(/[,;]$/, "");
                                  if (!next) return;
                                  setComposeTo([...splitEmails(composeTo), next].join(", "));
                                  setToDraft("");
                                }
                              }}
                              onBlur={() => {
                                const next = toDraft.trim().replace(/[,;]$/, "");
                                if (!next) return;
                                setComposeTo([...splitEmails(composeTo), next].join(", "));
                                setToDraft("");
                              }}
                            />
                          </div>
                        </li>
                        <li className="list-group-item d-flex align-items-center px-0 py-1 bg-transparent">
                          <span className="text-body minw-100px">CC</span>
                          <div className="mb-chips">
                            {splitEmails(composeCc).map((email) => (
                              <span className="mb-chip" key={email}>
                                <span>{email}</span>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-primary"
                                  aria-label={`Retirer ${email}`}
                                  onClick={() =>
                                    setComposeCc(splitEmails(composeCc).filter((item) => item !== email).join(", "))
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              className="form-control border-0 shadow-none px-1 flex-grow-1"
                              style={{ minWidth: 120 }}
                              value={ccDraft}
                              disabled={sending}
                              onChange={(e) => setCcDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "," || e.key === ";") {
                                  e.preventDefault();
                                  const next = ccDraft.trim().replace(/[,;]$/, "");
                                  if (!next) return;
                                  setComposeCc([...splitEmails(composeCc), next].join(", "));
                                  setCcDraft("");
                                }
                              }}
                            />
                          </div>
                        </li>
                        <li className="list-group-item d-flex align-items-center px-0 py-2 bg-transparent">
                          <span className="text-body minw-100px">Subject</span>
                          <input
                            type="text"
                            className="form-control border-0 shadow-none text-dark"
                            value={composeSubject}
                            onChange={(e) => setComposeSubject(e.target.value)}
                            disabled={sending}
                            required
                          />
                        </li>
                      </ul>
                    </div>
                    <textarea
                      className="form-control mail-textarea"
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      disabled={sending}
                      placeholder="Écrire un message…"
                    />
                    <div className="d-flex align-items-center px-4 py-3">
                      <button type="submit" className="btn btn-primary waves-effect waves-light" disabled={sending}>
                        {sending ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Envoi…
                          </>
                        ) : (
                          "Envoyer"
                        )}
                      </button>
                      <button type="button" className="btn btn-action-gray text-dark btn-icon waves-effect ms-3" aria-label="Lien" tabIndex={-1}>
                        <i className="fi fi-rr-link-alt" />
                      </button>
                      <button type="button" className="btn btn-action-gray text-dark btn-icon waves-effect ms-1" aria-label="Image" tabIndex={-1}>
                        <i className="fi fi-rr-add-image" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-primary mb-fab" onClick={openCompose}>
            Compose
          </button>
        </>
      )}
    </div>
  );
}
