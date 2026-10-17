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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    return `${start} – ${end} of ${total}`;
  }, [items.length, page, total]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCompose() {
    setComposing(true);
    setSelectedUid(null);
    setMessage(null);
    setReplying(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeError(null);
    setSidebarOpen(false);
  }

  function selectFolder(id: string) {
    setFolderId(id);
    setPage(1);
    setSelectedUid(null);
    setMessage(null);
    setComposing(false);
    setReplying(false);
    setSidebarOpen(false);
  }

  async function openMessage(item: MailListItem) {
    if (!folderId) return;
    setComposing(false);
    setReplying(false);
    setSelectedUid(item.uid);
    setMessage(null);
    setMessageLoading(true);
    setMessageError(null);
    setSidebarOpen(false);
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
    const to = composeTo.trim();
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
    <div className="container-fluid mailbox-page">
      <style>{`
        .mailbox-page .mail-split {
          display: flex;
          min-height: 0;
          height: calc(100% - 65px);
        }
        .mailbox-page .mail-split-list,
        .mailbox-page .mail-split-read {
          min-width: 0;
          min-height: 0;
          overflow: auto;
        }
        .mailbox-page .mail-split-list { flex: 1 1 54%; }
        .mailbox-page .mail-split-read {
          flex: 1 1 46%;
          border-left: 1px solid var(--bs-border-color);
          background: var(--bs-body-bg);
        }
        .mailbox-page .mail-list { height: auto; }
        .mailbox-page .mail-list-item.is-active {
          background: rgba(var(--bs-primary-rgb), 0.08);
        }
        .mailbox-page .mail-list-item.mail-unread .mail-item-username,
        .mailbox-page .mail-list-item.mail-unread .mail-item-subject {
          font-weight: 700;
        }
        .mailbox-page .mail-html img { max-width: 100%; height: auto; }
        .mailbox-page .mail-html a { color: var(--bs-primary); }
        @media (max-width: 991.98px) {
          .mailbox-page .mail-split { height: auto; display: block; }
          .mailbox-page .mail-split.is-reading .mail-split-list { display: none; }
          .mailbox-page .mail-split:not(.is-reading) .mail-split-read { display: none; }
          .mailbox-page .mail-split-read { border-left: 0; }
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
        <div className="row">
          <div className="col-12">
            <div className="card card-body overflow-hidden mail-wrapper p-0">
              <div
                className={`sidebar-mobile-overlay${sidebarOpen ? " show" : ""}`}
                onClick={() => setSidebarOpen(false)}
              />
              <div className={`mail-sidebar bg-light${sidebarOpen ? " open" : ""}`}>
                <div className="px-3 pt-3 mb-2">
                  <button
                    type="button"
                    className="btn btn-primary waves-effect waves-light w-100"
                    onClick={openCompose}
                  >
                    Nouveau message
                  </button>
                </div>
                <div className="d-grid gap-2 p-2 mail-nav" role="tablist">
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
                      const active = folder.id === folderId && !composing;
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          className={`mail-nav-item border-0 bg-transparent text-start${active ? " active" : ""}`}
                          onClick={() => selectFolder(folder.id)}
                        >
                          <i className={`${view.icon} me-2`} /> {view.label}
                          {folder.unseen > 0 ? (
                            <span className="badge badge-sm bg-primary-subtle text-primary ms-auto">
                              {folder.unseen}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mail-body">
                {composing ? (
                  <form onSubmit={(e) => void handleSend(e)}>
                    <div className="mail-header">
                      <button
                        type="button"
                        className="btn btn-white btn-shadow btn-icon waves-effect mail-sidebar-toggler d-lg-none"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Dossiers"
                      >
                        <i className="fi fi-rs-list" />
                      </button>
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
                        <li className="list-group-item d-flex align-items-center px-0 py-0">
                          <span className="text-body minw-100px">To</span>
                          <input
                            className="form-control border-0 shadow-none px-2"
                            type="email"
                            value={composeTo}
                            onChange={(e) => setComposeTo(e.target.value)}
                            disabled={sending}
                            required
                          />
                        </li>
                        <li className="list-group-item d-flex align-items-center px-0 py-2">
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
                    <div className="d-flex px-4 py-2">
                      <button type="submit" className="btn btn-primary waves-effect waves-light" disabled={sending}>
                        {sending ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Envoi…
                          </>
                        ) : (
                          "Send Message"
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="mail-header">
                      <button
                        type="button"
                        className="btn btn-white btn-shadow btn-icon waves-effect mail-sidebar-toggler d-lg-none"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Dossiers"
                      >
                        <i className="fi fi-rs-list" />
                      </button>
                      <form
                        className="d-flex align-items-center h-100 w-200px w-md-250px position-relative me-auto"
                        onSubmit={(e) => e.preventDefault()}
                      >
                        <button type="button" className="btn btn-sm border-0 position-absolute start-0 ms-3 p-0">
                          <i className="fi fi-rr-search" />
                        </button>
                        <input
                          type="search"
                          className="form-control ps-5"
                          placeholder="Search"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                        />
                      </form>
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-white btn-shadow btn-icon waves-effect"
                          onClick={() => void loadList()}
                          aria-label="Actualiser"
                          disabled={listLoading}
                        >
                          <i className="fi fi-rr-rotate-right" />
                        </button>
                        <span className="small text-nowrap">{rangeLabel}</span>
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

                    <div className={`mail-split${selectedUid ? " is-reading" : ""}`}>
                      <div className="mail-split-list">
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
                          <ul className="list-unstyled mail-list m-0">
                            {items.map((item) => (
                              <li
                                key={item.uid}
                                className={`mail-list-item${item.seen ? "" : " mail-unread"}${
                                  item.uid === selectedUid ? " is-active" : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  className="mail-item-content ms-2 ms-sm-0 me-2 border-0 bg-transparent text-start p-0"
                                  onClick={() => void openMessage(item)}
                                >
                                  <span className="mail-item-username me-2">{parseAddress(item.from).name}</span>
                                  <span className="mail-item-subject">{item.subject}</span>
                                  {item.snippet ? (
                                    <span className="mail-item-text text-body"> {item.snippet}</span>
                                  ) : null}
                                </button>
                                <div className="mail-item-meta ms-auto">
                                  <small className="mail-item-time d-inline-flex align-items-center gap-1">
                                    {item.hasAttachments ? (
                                      <i className="fi fi-rr-clip" title="Pièce jointe" />
                                    ) : null}
                                    {formatListDate(item.date)}
                                  </small>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {selectedUid ? (
                        <div className="mail-split-read">
                          <div className="d-flex align-items-center gap-2 border-bottom px-3 py-2">
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
                            <span className="small text-muted">Message</span>
                          </div>
                          {messageLoading ? (
                            <div className="text-center py-5">
                              <div className="spinner-border text-primary" role="status" />
                            </div>
                          ) : messageError ? (
                            <p className="text-danger text-center py-4">{messageError}</p>
                          ) : message ? (
                            <>
                              <div className="border-bottom p-sm-4 p-3">
                                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                                  <h4 className="mb-0">{message.subject}</h4>
                                  <small>{formatDateTime(message.date, CASABLANCA_TZ)}</small>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="avatar avatar-sm bg-primary text-white bg-opacity-10 rounded-circle fw-bold">
                                    {(parseAddress(message.from).name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="clearfix">
                                    <div className="d-flex flex-wrap align-items-center">
                                      <h6 className="mb-0 me-2">{parseAddress(message.from).name}</h6>
                                      <span className="small text-muted">{parseAddress(message.from).email}</span>
                                    </div>
                                    <div className="small text-muted">
                                      <span className="me-1">To:</span>
                                      <span>{message.to || "—"}</span>
                                      {message.cc ? <span className="ms-2">CC: {message.cc}</span> : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="mail-read-wrapper">
                                <div
                                  className="mail-html text-dark p-sm-4 p-3"
                                  dangerouslySetInnerHTML={{ __html: safeBody || "<p>—</p>" }}
                                />
                                {message.attachments.length > 0 ? (
                                  <div className="p-sm-4 p-3 pt-0">
                                    <h5 className="mb-2 fw-semibold">Attachment</h5>
                                    <div className="p-3 bg-light rounded-2">
                                      <ul className="list-unstyled mb-0">
                                        {message.attachments.map((file) => (
                                          <li key={file.filename} className="d-flex align-items-center gap-2 py-1">
                                            <i className="fi fi-rr-clip" />
                                            <span>{file.filename}</span>
                                            {file.size != null ? (
                                              <small className="text-muted">{Math.ceil(file.size / 1024)} Ko</small>
                                            ) : null}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="px-sm-4 px-3 pb-4">
                                  {replying ? (
                                    <form onSubmit={(e) => void handleReply(e)}>
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
                                          <input
                                            className="form-control border-0 shadow-none text-dark"
                                            value={replySubjectValue}
                                            readOnly
                                          />
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
                                          {sending ? "Envoi…" : "Send Message"}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-light"
                                          disabled={sending}
                                          onClick={() => setReplying(false)}
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <button type="button" className="btn btn-primary" onClick={startReply}>
                                      Répondre
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
