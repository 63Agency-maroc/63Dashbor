"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { AppToast } from "@/components/clients/AppToast";
import { ApiError } from "@/lib/api/client";
import {
  cancelBroadcast,
  createBroadcast,
  getBroadcast,
  getBroadcastResults,
  isBroadcastActive,
  listBroadcasts,
  type BroadcastDoneEvent,
  type BroadcastJobDetail,
  type BroadcastJobSummary,
  type BroadcastProgressEvent,
  type BroadcastRecipient,
  type BroadcastResultItem,
  type CreateBroadcastDto,
} from "@/lib/api/broadcast";
import { getLeads, getLeadsMeta, type Lead, type LeadsMetaResponse } from "@/lib/api/leads";
import { getTemplates, type WhatsappTemplate } from "@/lib/api/whatsapp";
import {
  getEmailTemplateMapping,
  saveEmailTemplateMapping,
} from "@/lib/api/email-templates";
import { getSocket } from "@/lib/realtime/socket";
import {
  hasUsablePhone,
  normalizePhoneDigits,
  variable1FromName,
} from "@/lib/whatsapp/phones";
import {
  getLeadEmail,
  getLeadName,
  getLeadPhone,
  leadHasContact,
} from "@/lib/leads/clickup-fields";
import {
  applyTemplatePreview,
  detectTemplateVarIndices,
} from "@/lib/whatsapp/templatePlaceholders";
import { Select } from "@/components/ui/Select";

const LEADS_FETCH = 200;
const TABLE_PAGE = 15;
const RESULTS_PAGE = 50;
const POLL_MS = 3000;
const PREVIEW_SAMPLES = 4;

type WizardStep = 1 | 2 | 3;

/** Destinataire retenu (dédupliqué par leadId / phone / email). */
type SelectedRecipient = {
  key: string;
  phoneNumber?: string;
  email?: string;
  name: string;
  source: "lead" | "manual";
  leadId?: string;
  /** Métadonnées filtre — affichage récap / audit avant envoi */
  leadStatus?: string;
  leadListName?: string;
};

/** Snapshot des filtres utilisés pour « tout le filtre » (confirmation d’envoi). */
type SelectionFilterSnapshot = {
  status: string;
  listId: string;
  listName: string;
  search: string;
  filteredTotal: number;
  selectedWithContact: number;
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "done" || s === "success") return "bg-success-subtle text-success";
  if (s === "failed" || s === "error") return "bg-danger-subtle text-danger";
  if (s === "cancelled" || s === "canceled") return "bg-secondary-subtle text-secondary";
  if (isBroadcastActive(s)) return "bg-primary-subtle text-primary";
  return "bg-warning-subtle text-warning";
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dash(v: string | null | undefined) {
  const s = (v ?? "").trim();
  return s || "—";
}

function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function templateLabel(t: WhatsappTemplate) {
  return `${t.name} · ${t.language}${t.status ? ` · ${t.status}` : ""}`;
}

function sortTemplates(list: WhatsappTemplate[]) {
  return [...list].sort((a, b) => {
    const aOk = /approved/i.test(a.status) ? 0 : 1;
    const bOk = /approved/i.test(b.status) ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    return a.name.localeCompare(b.name) || a.language.localeCompare(b.language);
  });
}

function leadIdKey(lead: { id?: string | number | null }): string {
  return lead.id == null ? "" : String(lead.id);
}

function recipientDedupeKey(r: {
  leadId?: string;
  phoneNumber?: string;
  email?: string;
}): string {
  if (r.leadId) return `lead:${r.leadId}`;
  if (r.phoneNumber) return `p:${r.phoneNumber}`;
  if (r.email) return `e:${r.email.toLowerCase()}`;
  return "";
}

function leadToRecipient(lead: Lead): SelectedRecipient | null {
  const id = leadIdKey(lead);
  if (!id || !leadHasContact(lead)) return null;
  const phone = getLeadPhone(lead);
  const email = getLeadEmail(lead);
  const name = getLeadName(lead).trim() || "Client";
  return {
    key: `lead:${id}`,
    phoneNumber: phone || undefined,
    email: email || undefined,
    name,
    source: "lead",
    leadId: id,
    leadStatus: lead.status || undefined,
    leadListName: lead.listName || undefined,
  };
}

/** Garde client : un lead hors filtre actif ne doit jamais entrer en sélection. */
function leadMatchesActiveFilters(
  lead: Lead,
  filters: { status: string; listId: string; search: string },
): boolean {
  if (filters.status && lead.status !== filters.status) return false;
  if (filters.listId && lead.listId !== filters.listId) return false;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const hay = [lead.name, lead.phone, lead.email, getLeadName(lead), getLeadPhone(lead), getLeadEmail(lead)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function applyEmailPlaceholders(html: string, name: string): string {
  const n = name.trim() || "Client";
  return html
    .replace(/\{\{\s*name\s*\}\}/gi, n)
    .replace(/\{\{\s*1\s*\}\}/g, n);
}

function channelSendLabel(wa: boolean, email: boolean): string {
  if (wa && email) return "Envoyer WhatsApp + email";
  if (wa) return "Envoyer WhatsApp";
  if (email) return "Envoyer email";
  return "Envoyer";
}

export default function WhatsappBroadcastPage() {
  const { user } = useAuth();
  const { connected: liveConnected } = useRealtime();
  const role = user?.role ?? "";
  const allowed = role === "admin" || role === "admin_whatsapp";
  const isAdmin = role === "admin";

  const [forbidden, setForbidden] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "danger" | "info" } | null>(
    null,
  );

  // —— Filtres leads ——
  const [meta, setMeta] = useState<LeadsMetaResponse | null>(null);
  const [status, setStatus] = useState("");
  const [listId, setListId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [pageLeads, setPageLeads] = useState<Lead[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [leadsOffset, setLeadsOffset] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [selectingAllFilter, setSelectingAllFilter] = useState(false);

  /** Sélection par leadId */
  const [selectedByLeadId, setSelectedByLeadId] = useState<Record<string, SelectedRecipient>>({});
  const [manualRecipients, setManualRecipients] = useState<SelectedRecipient[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  /** Filtres figés au moment de « Sélectionner tout le filtre » (null = sélection manuelle/page). */
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilterSnapshot | null>(null);

  const [selectedTableOffset, setSelectedTableOffset] = useState(0);

  // —— Canaux + template ——
  const [channelWhatsapp, setChannelWhatsapp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailMappingLoading, setEmailMappingLoading] = useState(false);
  const [emailMappingSaving, setEmailMappingSaving] = useState(false);
  const [emailMappingHint, setEmailMappingHint] = useState<string | null>(null);

  // —— Envoi ——
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<BroadcastJobDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // —— Historique ——
  const [history, setHistory] = useState<BroadcastJobSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [results, setResults] = useState<BroadcastResultItem[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsOffset, setResultsOffset] = useState(0);
  const [resultsLoading, setResultsLoading] = useState(false);

  const activeJobIdRef = useRef<string | null>(null);
  activeJobIdRef.current = activeJobId;
  const lastSocketAtRef = useRef(0);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => {
        if (prev !== next) setLeadsOffset(0);
        return next;
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  /** Destinataires finaux dédupliqués. */
  const finalRecipients = useMemo(() => {
    const map = new Map<string, SelectedRecipient>();
    for (const r of Object.values(selectedByLeadId)) {
      map.set(r.key || recipientDedupeKey(r), r);
    }
    for (const r of manualRecipients) {
      map.set(r.key || recipientDedupeKey(r), r);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [selectedByLeadId, manualRecipients]);

  const waRecipientCount = useMemo(
    () => finalRecipients.filter((r) => r.phoneNumber).length,
    [finalRecipients],
  );
  const emailRecipientCount = useMemo(
    () => finalRecipients.filter((r) => r.email).length,
    [finalRecipients],
  );

  const selectableOnPage = useMemo(
    () => pageLeads.filter((l) => leadHasContact(l)),
    [pageLeads],
  );

  const selectedLeadCount = useMemo(
    () => Object.keys(selectedByLeadId).length,
    [selectedByLeadId],
  );

  const activeFilterLabel = useMemo(() => {
    const statusLabel = status || "Tous";
    const listLabel =
      (listId && meta?.lists?.find((l) => l.id === listId)?.name) ||
      (listId ? listId : "Toutes");
    const searchLabel = search ? ` · recherche: « ${search} »` : "";
    return `statut: ${statusLabel}, liste: ${listLabel}${searchLabel}`;
  }, [status, listId, search, meta]);

  const confirmFilterLabel = useMemo(() => {
    if (selectionFilter) {
      const statusLabel = selectionFilter.status || "Tous";
      const listLabel = selectionFilter.listName || (selectionFilter.listId ? selectionFilter.listId : "Toutes");
      const searchLabel = selectionFilter.search
        ? ` · recherche: « ${selectionFilter.search} »`
        : "";
      return `statut: ${statusLabel}, liste: ${listLabel}${searchLabel}`;
    }
    return activeFilterLabel;
  }, [selectionFilter, activeFilterLabel]);
  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((l) => Boolean(selectedByLeadId[leadIdKey(l)]));

  const selectedTemplate = useMemo(() => {
    if (!selectedKey) return null;
    return templates.find((t) => `${t.name}||${t.language}` === selectedKey) ?? null;
  }, [selectedKey, templates]);

  const varIndices = useMemo(
    () => detectTemplateVarIndices(selectedTemplate?.body),
    [selectedTemplate],
  );
  const hasVar1 = varIndices.includes(1);
  const usePersonalized = hasVar1;

  const personalizedPreviews = useMemo(() => {
    if (!selectedTemplate?.body || !channelWhatsapp) return [];
    return finalRecipients
      .filter((r) => r.phoneNumber)
      .slice(0, PREVIEW_SAMPLES)
      .map((r) => ({
        name: r.name,
        phone: r.phoneNumber!,
        text: applyTemplatePreview(selectedTemplate.body, {
          1: variable1FromName(r.name) || "Client",
        }),
      }));
  }, [selectedTemplate, channelWhatsapp, finalRecipients]);

  const emailPreviewHtml = useMemo(() => {
    if (!emailHtml.trim()) return "";
    const sample = finalRecipients[0]?.name || "Karim";
    return applyEmailPlaceholders(emailHtml, sample);
  }, [emailHtml, finalRecipients]);

  // Load email mapping when template changes + email channel on
  useEffect(() => {
    if (!channelEmail || !selectedTemplate?.name) {
      setEmailMappingHint(null);
      return;
    }
    let cancelled = false;
    setEmailMappingLoading(true);
    void getEmailTemplateMapping(selectedTemplate.name)
      .then((m) => {
        if (cancelled) return;
        if (m) {
          setEmailSubject(m.subject);
          setEmailHtml(m.htmlBody);
          setEmailMappingHint("Modèle email chargé depuis le mapping.");
        } else {
          setEmailMappingHint("Aucun mapping email — renseignez objet et corps.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setEmailMappingHint(
          err instanceof ApiError ? err.message : "Impossible de charger le mapping email.",
        );
      })
      .finally(() => {
        if (!cancelled) setEmailMappingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelEmail, selectedTemplate?.name]);

  const loadMeta = useCallback(async () => {
    try {
      const m = await getLeadsMeta();
      setMeta(m);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await getTemplates();
      setTemplates(sortTemplates(res.templates ?? []));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      setTemplatesError(err instanceof ApiError ? err.message : "Impossible de charger les templates.");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await listBroadcasts();
      setHistory(res.items ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      setHistoryError(err instanceof ApiError ? err.message : "Historique indisponible.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadLeadsPage = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const page = await getLeads({
        status: status || undefined,
        listId: listId || undefined,
        search: search || undefined,
        limit: TABLE_PAGE,
        offset: leadsOffset,
      });
      if (seq !== loadSeqRef.current) return;
      setPageLeads(page.items ?? []);
      setFilteredTotal(page.total ?? 0);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      setLeadsError(err instanceof ApiError ? err.message : "Chargement des leads impossible.");
      setPageLeads([]);
      setFilteredTotal(0);
    } finally {
      if (seq === loadSeqRef.current) setLeadsLoading(false);
    }
  }, [status, listId, search, leadsOffset]);

  useEffect(() => {
    if (!allowed) return;
    void loadMeta();
    void loadTemplates();
    void loadHistory();
  }, [allowed, loadMeta, loadTemplates, loadHistory]);

  useEffect(() => {
    if (!allowed || forbidden) return;
    void loadLeadsPage();
  }, [allowed, forbidden, loadLeadsPage]);

  // Reset offset + sélection leads quand les filtres changent (évite cibles hors filtre)
  useEffect(() => {
    setLeadsOffset(0);
    setSelectedByLeadId({});
    setSelectionFilter(null);
    setSelectedTableOffset(0);
  }, [status, listId, search]);

  const applyJobProgress = useCallback(
    (ev: {
      jobId: string;
      status: string;
      total: number;
      sent?: number;
      failed?: number;
      waSent?: number;
      waFailed?: number;
      emailSent?: number;
      emailFailed?: number;
      error?: string | null;
    }) => {
      if (ev.jobId !== activeJobIdRef.current) return;
      const waSent = ev.waSent ?? 0;
      const waFailed = ev.waFailed ?? 0;
      const emailSent = ev.emailSent ?? 0;
      const emailFailed = ev.emailFailed ?? 0;
      const sent = ev.sent ?? waSent + emailSent;
      const failed = ev.failed ?? waFailed + emailFailed;
      setJobDetail((prev) => ({
        id: ev.jobId,
        status: ev.status,
        total: ev.total,
        sent,
        failed,
        waSent,
        waFailed,
        emailSent,
        emailFailed,
        startedAt: prev?.startedAt ?? null,
        finishedAt: isBroadcastActive(ev.status) ? null : (prev?.finishedAt ?? new Date().toISOString()),
        error: ev.error ?? prev?.error ?? null,
        messageConfig: prev?.messageConfig ?? null,
        createdBy: prev?.createdBy ?? null,
      }));
      if (!isBroadcastActive(ev.status)) void loadHistory();
    },
    [loadHistory],
  );

  useEffect(() => {
    if (!allowed || forbidden) return;
    let socket;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onProgress = (ev: BroadcastProgressEvent) => {
      if (!ev?.jobId) return;
      lastSocketAtRef.current = Date.now();
      applyJobProgress(ev);
      setHistory((prev) =>
        prev.map((j) =>
          j.id === ev.jobId
            ? {
                ...j,
                status: ev.status,
                total: ev.total,
                sent: ev.sent ?? (ev.waSent ?? 0) + (ev.emailSent ?? 0),
                failed: ev.failed ?? (ev.waFailed ?? 0) + (ev.emailFailed ?? 0),
                waSent: ev.waSent,
                waFailed: ev.waFailed,
                emailSent: ev.emailSent,
                emailFailed: ev.emailFailed,
              }
            : j,
        ),
      );
    };

    const onDone = (ev: BroadcastDoneEvent) => {
      if (!ev?.jobId) return;
      lastSocketAtRef.current = Date.now();
      applyJobProgress(ev);
      const waSent = ev.waSent ?? 0;
      const waFailed = ev.waFailed ?? 0;
      const emailSent = ev.emailSent ?? 0;
      const emailFailed = ev.emailFailed ?? 0;
      setHistory((prev) =>
        prev.map((j) =>
          j.id === ev.jobId
            ? {
                ...j,
                status: ev.status,
                total: ev.total,
                sent: ev.sent ?? waSent + emailSent,
                failed: ev.failed ?? waFailed + emailFailed,
                waSent,
                waFailed,
                emailSent,
                emailFailed,
                finishedAt: new Date().toISOString(),
              }
            : j,
        ),
      );
      if (ev.jobId === activeJobIdRef.current) {
        setToast({
          message: `Terminé — WA ${waSent}/${waFailed} · Email ${emailSent}/${emailFailed}`,
          variant: waFailed + emailFailed > 0 ? "info" : "success",
        });
      }
    };

    socket.on("broadcast:progress", onProgress);
    socket.on("broadcast:done", onDone);
    return () => {
      socket.off("broadcast:progress", onProgress);
      socket.off("broadcast:done", onDone);
    };
  }, [allowed, forbidden, applyJobProgress]);

  useEffect(() => {
    if (!activeJobId || !jobDetail || !isBroadcastActive(jobDetail.status)) return;
    const tick = async () => {
      if (Date.now() - lastSocketAtRef.current < POLL_MS - 500) return;
      try {
        const d = await getBroadcast(activeJobId);
        if (activeJobIdRef.current !== activeJobId) return;
        setJobDetail(d);
        if (!isBroadcastActive(d.status)) void loadHistory();
      } catch {
        /* retry */
      }
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [activeJobId, jobDetail?.status, loadHistory]);

  const loadResults = useCallback(async (jobId: string, offset = 0) => {
    setResultsLoading(true);
    try {
      const page = await getBroadcastResults(jobId, { limit: RESULTS_PAGE, offset });
      setResults(page.items ?? []);
      setResultsTotal(page.total ?? 0);
      setResultsOffset(offset);
      setSelectedHistoryId(jobId);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Résultats indisponibles.",
        variant: "danger",
      });
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const openHistoryJob = useCallback(
    async (jobId: string) => {
      setSelectedHistoryId(jobId);
      setActiveJobId(jobId);
      setStep(3);
      try {
        const d = await getBroadcast(jobId);
        setJobDetail(d);
        if (!isBroadcastActive(d.status)) await loadResults(jobId, 0);
      } catch (err) {
        setToast({
          message: err instanceof ApiError ? err.message : "Détail indisponible.",
          variant: "danger",
        });
      }
    },
    [loadResults],
  );

  function toggleLead(lead: Lead) {
    const id = leadIdKey(lead);
    if (!id || !leadHasContact(lead)) return;
    if (!leadMatchesActiveFilters(lead, { status, listId, search })) return;
    const row = leadToRecipient(lead);
    if (!row) return;
    setSelectionFilter(null);
    setSelectedByLeadId((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = row;
      return next;
    });
  }

  function selectPage() {
    setSelectionFilter(null);
    setSelectedByLeadId((prev) => {
      const next = { ...prev };
      for (const lead of selectableOnPage) {
        if (!leadMatchesActiveFilters(lead, { status, listId, search })) continue;
        const row = leadToRecipient(lead);
        const id = leadIdKey(lead);
        if (row && id) next[id] = row;
      }
      return next;
    });
  }

  function deselectPage() {
    setSelectedByLeadId((prev) => {
      const next = { ...prev };
      for (const lead of pageLeads) {
        delete next[leadIdKey(lead)];
      }
      return next;
    });
  }

  function deselectAll() {
    setSelectedByLeadId({});
    setManualRecipients([]);
    setSelectionFilter(null);
    setSelectedTableOffset(0);
  }

  async function selectEntireFilter() {
    // Figer les filtres actifs au clic (mêmes params que la table affichée)
    const filters = {
      status: status.trim(),
      listId: listId.trim(),
      search: search.trim(),
    };
    const listName =
      (filters.listId && meta?.lists?.find((l) => l.id === filters.listId)?.name) || "";

    setSelectingAllFilter(true);
    setLeadsError(null);
    try {
      const all: Lead[] = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total) {
        const page = await getLeads({
          status: filters.status || undefined,
          listId: filters.listId || undefined,
          search: filters.search || undefined,
          limit: LEADS_FETCH,
          offset,
        });
        total = page.total ?? 0;
        const items = page.items ?? [];
        // Ne garder QUE les leads qui matchent encore le filtre (filet de sécurité client)
        for (const lead of items) {
          if (leadMatchesActiveFilters(lead, filters)) all.push(lead);
        }
        offset += items.length;
        if (items.length === 0) break;
        // Garde-fou boucle : si l’API ignore le filtre, items.raw peut dépasser total filtré
        if (offset >= total) break;
      }

      // REMPLACE la sélection leads (pas de merge avec d’anciens leads hors filtre)
      const next: Record<string, SelectedRecipient> = {};
      let withContact = 0;
      let rejected = 0;
      for (const lead of all) {
        if (!leadMatchesActiveFilters(lead, filters)) {
          rejected += 1;
          continue;
        }
        const row = leadToRecipient(lead);
        const id = leadIdKey(lead);
        if (!row || !id) continue;
        next[id] = row;
        withContact += 1;
      }

      setSelectedByLeadId(next);
      setSelectionFilter({
        status: filters.status,
        listId: filters.listId,
        listName,
        search: filters.search,
        filteredTotal: total,
        selectedWithContact: withContact,
      });
      setSelectedTableOffset(0);
      setFilteredTotal(total);

      const rejectHint =
        rejected > 0
          ? ` (${rejected} hors filtre ignoré(s) — vérifier l’API).`
          : "";
      setToast({
        message: `${withContact} lead(s) avec contact sélectionnés sur ${total} filtrés (${filters.status || "tous"} / ${listName || filters.listId || "toutes"}).${rejectHint}`,
        variant: rejected > 0 ? "danger" : "success",
      });
    } catch (err) {
      setLeadsError(
        err instanceof ApiError ? err.message : "Sélection du filtre complet impossible.",
      );
    } finally {
      setSelectingAllFilter(false);
    }
  }

  function addManualRecipient() {
    const phone = normalizePhoneDigits(manualPhone);
    const email = manualEmail.trim();
    const name = manualName.trim() || "Client";
    const hasPhone = hasUsablePhone(phone);
    const hasEmail = Boolean(email && looksLikeEmail(email));
    if (!hasPhone && !hasEmail) {
      setToast({
        message: "Indiquez un téléphone valide (—0— 9 chiffres) ou un email.",
        variant: "danger",
      });
      return;
    }
    const row: SelectedRecipient = {
      key: recipientDedupeKey({
        phoneNumber: hasPhone ? phone : undefined,
        email: hasEmail ? email : undefined,
      }),
      phoneNumber: hasPhone ? phone : undefined,
      email: hasEmail ? email : undefined,
      name,
      source: "manual",
    };
    setManualRecipients((prev) => {
      const without = prev.filter((r) => r.key !== row.key);
      return [...without, row];
    });
    setManualName("");
    setManualPhone("");
    setManualEmail("");
    setToast({ message: "Destinataire ajouté.", variant: "success" });
  }

  function removeRecipient(key: string) {
    setSelectedByLeadId((prev) => {
      const next = { ...prev };
      for (const [id, r] of Object.entries(next)) {
        if ((r.key || recipientDedupeKey(r)) === key) delete next[id];
      }
      return next;
    });
    setManualRecipients((prev) => prev.filter((r) => (r.key || recipientDedupeKey(r)) !== key));
  }

  function buildDto(): CreateBroadcastDto | null {
    if (finalRecipients.length === 0) return null;
    if (!channelWhatsapp && !channelEmail) return null;
    if (channelWhatsapp && !selectedTemplate) return null;
    if (channelEmail && (!emailSubject.trim() || !emailHtml.trim())) return null;

    const channels: CreateBroadcastDto["channels"] = {};
    if (channelWhatsapp) channels.whatsapp = true;
    if (channelEmail) channels.email = true;

    const recipients: BroadcastRecipient[] = finalRecipients.map((r) => {
      const item: BroadcastRecipient = { name: r.name || "Client" };
      if (r.phoneNumber) item.phoneNumber = r.phoneNumber;
      if (r.email) item.email = r.email;
      return item;
    });

    const dto: CreateBroadcastDto = { channels, recipients };
    if (channelWhatsapp && selectedTemplate) {
      dto.templateName = selectedTemplate.name;
      dto.templateLanguage = selectedTemplate.language || undefined;
    }
    if (channelEmail) {
      dto.emailSubject = emailSubject.trim();
      dto.emailHtml = emailHtml.trim();
    }
    return dto;
  }

  async function handleSend() {
    const dto = buildDto();
    if (!dto) {
      setSendError("Vérifiez canaux, destinataires et contenus requis.");
      return;
    }
    setConfirmSend(false);
    setSending(true);
    setSendError(null);
    try {
      const res = await createBroadcast(dto);
      setActiveJobId(res.jobId);
      setJobDetail({
        id: res.jobId,
        status: res.status,
        total: res.total,
        sent: 0,
        failed: 0,
        waSent: 0,
        waFailed: 0,
        emailSent: 0,
        emailFailed: 0,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        messageConfig: {
          templateName: dto.templateName,
          templateLanguage: dto.templateLanguage,
          channels: dto.channels,
          emailSubject: dto.emailSubject,
          emailHtml: dto.emailHtml,
          recipients: dto.recipients,
        },
        createdBy: user?.email ?? (user?.id != null ? String(user.id) : null),
      });
      setStep(3);
      setToast({ message: `Broadcast lancé (${res.total} destinataires).`, variant: "success" });
      void loadHistory();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEmailMapping() {
    if (!selectedTemplate?.name || !isAdmin) return;
    if (!emailSubject.trim() || !emailHtml.trim()) {
      setToast({ message: "Objet et corps email requis pour enregistrer.", variant: "danger" });
      return;
    }
    setEmailMappingSaving(true);
    try {
      await saveEmailTemplateMapping(selectedTemplate.name, {
        subject: emailSubject.trim(),
        html_body: emailHtml.trim(),
      });
      setToast({ message: "Modèle email enregistré.", variant: "success" });
      setEmailMappingHint("Modèle email enregistré comme défaut pour ce template WA.");
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Enregistrement impossible.",
        variant: "danger",
      });
    } finally {
      setEmailMappingSaving(false);
    }
  }

  function goStep2() {
    if (finalRecipients.length === 0) {
      setLeadsError("Sélectionnez au moins un destinataire (téléphone ou email).");
      return;
    }
    setLeadsError(null);
    setStep(2);
  }

  function goStep3() {
    if (!channelWhatsapp && !channelEmail) {
      setTemplatesError("Cochez au moins un canal (WhatsApp ou email).");
      return;
    }
    if (channelWhatsapp && !selectedTemplate) {
      setTemplatesError("Sélectionnez un template WhatsApp.");
      return;
    }
    if (channelEmail && (!emailSubject.trim() || !emailHtml.trim())) {
      setTemplatesError("Objet et corps HTML requis pour l'email.");
      return;
    }
    if (channelWhatsapp && waRecipientCount === 0) {
      setTemplatesError("Aucun destinataire avec téléphone pour WhatsApp.");
      return;
    }
    if (channelEmail && emailRecipientCount === 0) {
      setTemplatesError("Aucun destinataire avec email.");
      return;
    }
    setTemplatesError(null);
    setConfirmSend(false);
    setStep(3);
  }

  async function handleCancel() {
    if (!activeJobId) return;
    setCancelling(true);
    try {
      const res = await cancelBroadcast(activeJobId);
      setJobDetail((prev) => (prev ? { ...prev, status: res.status } : prev));
      setToast({ message: "Annulation demandée.", variant: "info" });
      void loadHistory();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "Annulation impossible.",
        variant: "danger",
      });
    } finally {
      setCancelling(false);
    }
  }

  const selectedPageSlice = finalRecipients.slice(
    selectedTableOffset,
    selectedTableOffset + TABLE_PAGE,
  );

  if (!allowed || forbidden) {
    return (
      <div className="container-fluid">
        <div className="app-page-head">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <a href="/">
                  <i className="fi fi-rr-home" /> Home
                </a>
              </li>
              <li className="breadcrumb-item">
                <Link href="/whatsapp">WhatsApp</Link>
              </li>
              <li className="breadcrumb-item active">Broadcast</li>
            </ol>
          </nav>
        </div>
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="avatar avatar-lg bg-warning-subtle text-warning rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
              <i className="fi fi-rr-lock scale-2x" />
            </div>
            <h5 className="mb-2">Accès non autorisé</h5>
            <p className="text-muted mb-0">Rôles autorisés : admin et admin_whatsapp.</p>
          </div>
        </div>
      </div>
    );
  }

  const jobRunning = jobDetail ? isBroadcastActive(jobDetail.status) : false;

  return (
    <div className="container-fluid">
      <AppToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onClose={() => setToast(null)}
      />

      <div className="app-page-head d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item">
              <Link href="/whatsapp">WhatsApp</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Broadcast
            </li>
          </ol>
        </nav>
        <div className="d-flex align-items-center gap-2">
          <span
            className="d-inline-flex align-items-center gap-1 small text-muted"
            title={liveConnected ? "Temps réel connecté" : "Hors ligne — polling actif"}
          >
            <span
              className="rounded-circle d-inline-block"
              style={{
                width: 8,
                height: 8,
                backgroundColor: liveConnected ? "#22c55e" : "#9ca3af",
              }}
            />
            {liveConnected ? "live" : "hors ligne"}
          </span>
          <Link href="/whatsapp" className="btn btn-sm btn-light">
            Inbox
          </Link>
        </div>
      </div>

      <div className="broadcast-steps mb-4" role="tablist" aria-label="Étapes du broadcast">
        {(
          [
            [1, "1. Destinataires"],
            [2, "2. Template"],
            [3, "3. Envoi"],
          ] as const
        ).map(([n, label]) => {
          const disabled =
            (n === 2 && finalRecipients.length === 0) ||
            (n === 3 && finalRecipients.length === 0) ||
            (n === 3 && !channelWhatsapp && !channelEmail) ||
            (n === 3 && channelWhatsapp && !selectedTemplate);
          return (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={step === n}
              disabled={disabled && step !== n}
              className={`broadcast-steps__item${step === n ? " is-active" : ""}`}
              onClick={() => {
                if (disabled) return;
                setStep(n);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ========== —0TAPE 1 ========== */}
      {step === 1 && (
        <>
          <div className="card mb-4">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h5 className="card-title mb-0">Sélection des leads</h5>
              <span className="badge bg-primary-subtle text-primary fs-6 fw-normal">
                {selectedLeadCount} leads sélectionnés · {finalRecipients.length} destinataires ·{" "}
                {filteredTotal} filtrés
              </span>
            </div>
            <div className="card-body">
              <p className="small text-muted mb-3">
                Filtre actif : <strong>{activeFilterLabel}</strong>
              </p>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="bc-list">
                    Liste ClickUp
                  </label>
                  <Select
                    id="bc-list"
                    value={listId}
                    onChange={setListId}
                    disabled={leadsLoading || selectingAllFilter}
                    placeholder="Toutes"
                    searchable
                    options={[
                      { value: "", label: "Toutes" },
                      ...(meta?.lists ?? []).map((l) => ({ value: l.id, label: l.name })),
                    ]}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="bc-status">
                    Statut
                  </label>
                  <Select
                    id="bc-status"
                    value={status}
                    onChange={setStatus}
                    disabled={leadsLoading || selectingAllFilter}
                    placeholder="Tous"
                    searchable
                    options={[
                      { value: "", label: "Tous" },
                      ...(meta?.statuses ?? []).map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="bc-search">
                    Recherche
                  </label>
                  <input
                    id="bc-search"
                    type="search"
                    className="form-control"
                    placeholder="Nom, téléphone, email⬦"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    disabled={leadsLoading || selectingAllFilter}
                  />
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={() => (allPageSelected ? deselectPage() : selectPage())}
                  disabled={leadsLoading || selectableOnPage.length === 0}
                >
                  {allPageSelected ? "Désélectionner la page" : "Tout sélectionner (page)"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => void selectEntireFilter()}
                  disabled={leadsLoading || selectingAllFilter || filteredTotal === 0}
                >
                  {selectingAllFilter ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" /> Sélection filtre⬦
                    </>
                  ) : (
                    "Sélectionner tout le filtre"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={deselectAll}
                  disabled={finalRecipients.length === 0}
                >
                  Désélectionner tout
                </button>
              </div>

              <p className="small text-muted mb-2">
                Un lead est cochable s'il a un téléphone <em>ou</em> un email (custom fields). Sans
                contact = grisé.
              </p>

              {leadsError && (
                <div className="alert alert-danger" role="alert">
                  {leadsError}
                </div>
              )}

              <div className="table-responsive border rounded">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>Nom</th>
                      <th>Téléphone</th>
                      <th>Email</th>
                      <th>Statut</th>
                      <th>Liste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsLoading && pageLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          <div className="spinner-border spinner-border-sm text-primary" />
                        </td>
                      </tr>
                    ) : pageLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          Aucun lead pour ces filtres
                        </td>
                      </tr>
                    ) : (
                      pageLeads.map((lead) => {
                        const id = leadIdKey(lead);
                        const phoneDigits = getLeadPhone(lead);
                        const email = getLeadEmail(lead);
                        const ok = leadHasContact(lead);
                        const checked = Boolean(id && selectedByLeadId[id]);
                        const displayName = getLeadName(lead) || lead.name || "";
                        return (
                          <tr
                            key={id || lead.clickupTaskId || phoneDigits || email}
                            className={ok ? (checked ? "table-active" : undefined) : "table-secondary text-muted"}
                            style={ok ? { cursor: "pointer" } : { opacity: 0.65 }}
                            onClick={() => {
                              if (ok) toggleLead(lead);
                            }}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={checked}
                                disabled={!ok || selectingAllFilter || !id}
                                onChange={() => toggleLead(lead)}
                                aria-label={`Sélectionner ${displayName || "lead"}`}
                              />
                            </td>
                            <td>{dash(displayName)}</td>
                            <td className="font-monospace small">{dash(phoneDigits)}</td>
                            <td className="small">{dash(email)}</td>
                            <td>
                              <span className="badge bg-secondary-subtle text-secondary">
                                {dash(lead.status)}
                              </span>
                            </td>
                            <td className="small">{dash(lead.listName)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={leadsOffset <= 0 || leadsLoading}
                  onClick={() => setLeadsOffset((o) => Math.max(0, o - TABLE_PAGE))}
                >
                  Précédent
                </button>
                <span className="small text-muted">
                  {filteredTotal === 0
                    ? "0"
                    : `${leadsOffset + 1}—${Math.min(leadsOffset + TABLE_PAGE, filteredTotal)} / ${filteredTotal}`}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={leadsOffset + TABLE_PAGE >= filteredTotal || leadsLoading}
                  onClick={() => setLeadsOffset((o) => o + TABLE_PAGE)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>

          {/* Ajout manuel */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Ajout manuel</h5>
            </div>
            <div className="card-body">
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label" htmlFor="bc-man-name">
                    Nom
                  </label>
                  <input
                    id="bc-man-name"
                    type="text"
                    className="form-control"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="ex. Karim"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" htmlFor="bc-man-phone">
                    Téléphone
                  </label>
                  <input
                    id="bc-man-phone"
                    type="text"
                    className="form-control font-monospace"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="2126⬦"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="bc-man-email">
                    Email
                  </label>
                  <input
                    id="bc-man-email"
                    type="email"
                    className="form-control"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                  />
                </div>
                <div className="col-md-2">
                  <button type="button" className="btn btn-outline-primary w-100" onClick={addManualRecipient}>
                    Ajouter
                  </button>
                </div>
              </div>
              <div className="form-text">Téléphone et/ou email requis.</div>
            </div>
          </div>

          {/* Récap sélectionnés */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Destinataires retenus</h5>
              <span className="text-muted small">
                {finalRecipients.length} · WA {waRecipientCount} · Email {emailRecipientCount}
              </span>
            </div>
            {selectionFilter ? (
              <div className="px-3 pt-3">
                <div className="alert alert-info py-2 small mb-0" role="status">
                  Sélection « tout le filtre » :{" "}
                  <strong>{selectionFilter.selectedWithContact}</strong> avec contact /{" "}
                  <strong>{selectionFilter.filteredTotal}</strong> filtrés —{" "}
                  {confirmFilterLabel}
                </div>
              </div>
            ) : null}
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Statut</th>
                      <th>Liste</th>
                      <th>Téléphone</th>
                      <th>Email</th>
                      <th>Source</th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPageSlice.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">
                          Aucun destinataire sélectionné
                        </td>
                      </tr>
                    ) : (
                      selectedPageSlice.map((r) => {
                        const key = r.key || recipientDedupeKey(r);
                        return (
                          <tr key={key}>
                            <td>{r.name}</td>
                            <td className="small">{r.source === "lead" ? dash(r.leadStatus) : "—"}</td>
                            <td className="small">{r.source === "lead" ? dash(r.leadListName) : "—"}</td>
                            <td className="font-monospace small">{dash(r.phoneNumber)}</td>
                            <td className="small">{dash(r.email)}</td>
                            <td>
                              <span
                                className={`badge ${
                                  r.source === "manual"
                                    ? "bg-info-subtle text-info"
                                    : "bg-secondary-subtle text-secondary"
                                }`}
                              >
                                {r.source === "manual" ? "Manuel" : "Lead"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-subtle-danger btn-icon"
                                title="Retirer"
                                onClick={() => removeRecipient(key)}
                              >
                                <i className="fi fi-rr-trash" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {finalRecipients.length > TABLE_PAGE && (
              <div className="card-footer d-flex justify-content-between align-items-center">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={selectedTableOffset <= 0}
                  onClick={() => setSelectedTableOffset((o) => Math.max(0, o - TABLE_PAGE))}
                >
                  Précédent
                </button>
                <span className="small text-muted">
                  {selectedTableOffset + 1}—
                  {Math.min(selectedTableOffset + TABLE_PAGE, finalRecipients.length)} /{" "}
                  {finalRecipients.length}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={selectedTableOffset + TABLE_PAGE >= finalRecipients.length}
                  onClick={() => setSelectedTableOffset((o) => o + TABLE_PAGE)}
                >
                  Suivant
                </button>
              </div>
            )}
            <div className="card-footer d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={goStep2}
                disabled={finalRecipients.length === 0}
              >
                Continuer ({finalRecipients.length})
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========== —0TAPE 2 ========== */}
      {step === 2 && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Message &amp; canaux</h5>
            <span className="badge bg-primary-subtle text-primary">
              {finalRecipients.length} destinataires · WA {waRecipientCount} · Email{" "}
              {emailRecipientCount}
            </span>
          </div>
          <div className="card-body">
            {templatesError && (
              <div className="alert alert-danger" role="alert">
                {templatesError}
              </div>
            )}

            <div className="d-flex flex-wrap gap-4 mb-4">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="bc-ch-wa"
                  checked={channelWhatsapp}
                  onChange={(e) => setChannelWhatsapp(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="bc-ch-wa">
                  WhatsApp <span className="text-muted small">({waRecipientCount})</span>
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="bc-ch-email"
                  checked={channelEmail}
                  onChange={(e) => setChannelEmail(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="bc-ch-email">
                  Envoyer aussi par email{" "}
                  <span className="text-muted small">({emailRecipientCount})</span>
                </label>
              </div>
            </div>

            {channelWhatsapp && (
              <>
                <h6 className="mb-2">WhatsApp</h6>
                {templatesLoading && (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label" htmlFor="bc-tpl">
                    Template
                  </label>
                  <Select
                    id="bc-tpl"
                    value={selectedKey}
                    onChange={setSelectedKey}
                    placeholder="— Choisir —"
                    searchable
                    options={[
                      { value: "", label: "— Choisir —" },
                      ...templates.map((t) => ({
                        value: `${t.name}||${t.language}`,
                        label: templateLabel(t),
                      })),
                    ]}
                  />
                </div>

                {selectedTemplate && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Corps du template</label>
                      <pre
                        className="bg-light border rounded p-3 small mb-0"
                        style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
                      >
                        {selectedTemplate.body || "(vide)"}
                      </pre>
                    </div>
                    {usePersonalized ? (
                      <div className="alert alert-success py-2">
                        Variable <code>{"{{1}}"}</code> —  personnalisé avec le nom de chaque
                        destinataire.
                      </div>
                    ) : (
                      <div className="alert alert-secondary py-2 mb-3">
                        Aucune variable — template envoyé tel quel.
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {channelEmail && (
              <>
                <hr />
                <h6 className="mb-2">Email</h6>
                {emailMappingLoading && (
                  <div className="small text-muted mb-2">
                    <span className="spinner-border spinner-border-sm me-1" /> Chargement du mapping⬦
                  </div>
                )}
                {emailMappingHint && (
                  <div className="alert alert-light border py-2 small">{emailMappingHint}</div>
                )}
                <div className="mb-3">
                  <label className="form-label" htmlFor="bc-email-subject">
                    Objet
                  </label>
                  <input
                    id="bc-email-subject"
                    type="text"
                    className="form-control"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Objet du message"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="bc-email-html">
                    Corps HTML
                  </label>
                  <textarea
                    id="bc-email-html"
                    className="form-control font-monospace small"
                    rows={8}
                    value={emailHtml}
                    onChange={(e) => setEmailHtml(e.target.value)}
                    placeholder={"<p>Bonjour {{name}},</p>\n<p>⬦</p>"}
                  />
                  <div className="form-text">
                    Utilisez <code>{"{{name}}"}</code> ou <code>{"{{1}}"}</code> pour le nom
                    (fallback « Client »). Signature ajoutée côté serveur.
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary mb-3"
                    disabled={
                      emailMappingSaving ||
                      !selectedTemplate?.name ||
                      !emailSubject.trim() ||
                      !emailHtml.trim()
                    }
                    onClick={() => void handleSaveEmailMapping()}
                  >
                    {emailMappingSaving ? "Enregistrement⬦" : "Enregistrer comme modèle email par défaut"}
                  </button>
                )}
                {emailPreviewHtml && (
                  <div className="mb-3">
                    <label className="form-label">Aperçu email</label>
                    <div
                      className="border rounded p-3 bg-white"
                      style={{ minHeight: 80 }}
                      dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                    />
                  </div>
                )}
              </>
            )}

            <div className="d-flex justify-content-between gap-2 mt-3">
              <button type="button" className="btn btn-light" onClick={() => setStep(1)}>
                Retour
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={goStep3}
                disabled={
                  (!channelWhatsapp && !channelEmail) ||
                  (channelWhatsapp && !selectedTemplate) ||
                  (channelEmail && (!emailSubject.trim() || !emailHtml.trim()))
                }
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== —0TAPE 3 ========== */}
      {step === 3 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Envoi &amp; progression</h5>
          </div>
          <div className="card-body">
            {!activeJobId && (
              <>
                <dl className="row mb-3">
                  <dt className="col-sm-3">Destinataires</dt>
                  <dd className="col-sm-9">
                    <strong>{finalRecipients.length}</strong>
                    {manualRecipients.length > 0
                      ? ` (${selectedLeadCount} leads + ${manualRecipients.length} manuels)`
                      : null}
                  </dd>
                  <dt className="col-sm-3">Filtre leads</dt>
                  <dd className="col-sm-9">{confirmFilterLabel}</dd>
                  <dt className="col-sm-3">Canaux</dt>
                  <dd className="col-sm-9">
                    {channelWhatsapp ? (
                      <span className="me-2">
                        WhatsApp : <strong>{waRecipientCount}</strong>
                      </span>
                    ) : null}
                    {channelEmail ? (
                      <span>
                        Email : <strong>{emailRecipientCount}</strong>
                      </span>
                    ) : null}
                  </dd>
                  {channelWhatsapp && (
                    <>
                      <dt className="col-sm-3">Template WA</dt>
                      <dd className="col-sm-9">
                        {selectedTemplate
                          ? `${selectedTemplate.name} (${selectedTemplate.language})`
                          : "—"}
                      </dd>
                    </>
                  )}
                  {channelEmail && (
                    <>
                      <dt className="col-sm-3">Objet email</dt>
                      <dd className="col-sm-9">{emailSubject || "—"}</dd>
                    </>
                  )}
                </dl>

                {channelWhatsapp && personalizedPreviews.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label">Aperçus WhatsApp</label>
                    <div className="d-flex flex-column gap-2">
                      {personalizedPreviews.map((p) => (
                        <div
                          key={p.phone}
                          className="border border-success-subtle bg-success-subtle rounded p-3"
                        >
                          <div className="small text-muted mb-1">
                            —  {p.name} <span className="font-monospace">({p.phone})</span>
                          </div>
                          <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                            {p.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {channelWhatsapp && !usePersonalized && selectedTemplate?.body && (
                  <div className="mb-3">
                    <label className="form-label">Aperçu WhatsApp</label>
                    <pre
                      className="border rounded p-3 small mb-0 bg-light"
                      style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
                    >
                      {selectedTemplate.body}
                    </pre>
                  </div>
                )}

                {channelEmail && emailPreviewHtml && (
                  <div className="mb-3">
                    <label className="form-label">Aperçu email</label>
                    <div
                      className="border rounded p-3 bg-white"
                      dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                    />
                  </div>
                )}

                {sendError && (
                  <div className="alert alert-danger" role="alert">
                    {sendError}
                  </div>
                )}

                {confirmSend ? (
                  <div className="alert alert-warning" role="alertdialog" aria-label="Confirmer l’envoi">
                    <p className="mb-2">
                      {channelSendLabel(channelWhatsapp, channelEmail)} à{" "}
                      <strong>{finalRecipients.length}</strong> destinataire(s)
                      {channelWhatsapp ? ` (WA ${waRecipientCount})` : ""}
                      {channelEmail ? ` (email ${emailRecipientCount})` : ""} ?
                    </p>
                    <p className="mb-3 small mb-md-3">
                      Filtre appliqué : <strong>{confirmFilterLabel}</strong>
                      {selectionFilter ? (
                        <>
                          {" "}
                          — sélection filtre : {selectionFilter.selectedWithContact} /{" "}
                          {selectionFilter.filteredTotal}
                        </>
                      ) : null}
                      {manualRecipients.length > 0 ? (
                        <> · + {manualRecipients.length} ajout(s) manuel(s)</>
                      ) : null}
                    </p>
                    <div className="d-flex flex-wrap gap-2 justify-content-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() => setConfirmSend(false)}
                        disabled={sending}
                      >
                        Non, annuler
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => void handleSend()}
                        disabled={sending}
                      >
                        {sending ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" /> Envoi…
                          </>
                        ) : (
                          `Oui, envoyer à ${finalRecipients.length} destinataire(s)`
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex justify-content-between gap-2">
                    <button type="button" className="btn btn-light" onClick={() => setStep(2)}>
                      Retour
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setConfirmSend(true)}
                      disabled={finalRecipients.length === 0 || sending || (!channelWhatsapp && !channelEmail)}
                    >
                      {channelSendLabel(channelWhatsapp, channelEmail)}
                    </button>
                  </div>
                )}
              </>
            )}

            {activeJobId && jobDetail && (
              <>
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div>
                    <span className={`badge ${statusBadge(jobDetail.status)} me-2`}>
                      {jobDetail.status}
                    </span>
                    <span className="text-muted small font-monospace">{jobDetail.id}</span>
                    {jobDetail.messageConfig?.templateName ? (
                      <div className="small mt-1">
                        Template : <strong>{jobDetail.messageConfig.templateName}</strong>
                      </div>
                    ) : null}
                  </div>
                  {jobRunning && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => void handleCancel()}
                      disabled={cancelling}
                    >
                      {cancelling ? "Annulation⬦" : "Annuler"}
                    </button>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-medium mb-2">
                        <i className="fab fa-whatsapp me-1 text-success" /> WhatsApp
                      </div>
                      <div className="small mb-2">
                        <span className="text-success">{jobDetail.waSent ?? 0} envoyés</span>
                        {" · "}
                        <span className="text-danger">{jobDetail.waFailed ?? 0} échoués</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-success"
                          style={{
                            width: `${
                              jobDetail.total
                                ? ((jobDetail.waSent ?? 0) / jobDetail.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="progress-bar bg-danger"
                          style={{
                            width: `${
                              jobDetail.total
                                ? ((jobDetail.waFailed ?? 0) / jobDetail.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-medium mb-2">
                        <i className="fi fi-rr-envelope me-1 text-primary" /> Email
                      </div>
                      <div className="small mb-2">
                        <span className="text-success">{jobDetail.emailSent ?? 0} envoyés</span>
                        {" · "}
                        <span className="text-danger">{jobDetail.emailFailed ?? 0} échoués</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-success"
                          style={{
                            width: `${
                              jobDetail.total
                                ? ((jobDetail.emailSent ?? 0) / jobDetail.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="progress-bar bg-danger"
                          style={{
                            width: `${
                              jobDetail.total
                                ? ((jobDetail.emailFailed ?? 0) / jobDetail.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-muted small mb-3">
                  Total traité : {(jobDetail.waSent ?? 0) + (jobDetail.waFailed ?? 0) + (jobDetail.emailSent ?? 0) + (jobDetail.emailFailed ?? 0)}{" "}
                  / ~{jobDetail.total * ((jobDetail.messageConfig?.channels?.whatsapp ? 1 : 0) + (jobDetail.messageConfig?.channels?.email ? 1 : 0) || 1)}
                </div>

                {jobDetail.error && (
                  <div className="alert alert-danger py-2">{jobDetail.error}</div>
                )}

                {!jobRunning && (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => void loadResults(activeJobId, 0)}
                  >
                    Voir les résultats
                  </button>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    onClick={() => {
                      setActiveJobId(null);
                      setJobDetail(null);
                      setConfirmSend(false);
                      setStep(1);
                    }}
                  >
                    Nouveau broadcast
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Résultats */}
      {selectedHistoryId && (results.length > 0 || resultsLoading || resultsTotal > 0) && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Résultats</h5>
            <span className="text-muted small">{resultsTotal} lignes</span>
          </div>
          <div className="card-body p-0">
            {resultsLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Téléphone</th>
                      <th>Email</th>
                      <th>WA</th>
                      <th>Email statut</th>
                      <th>Erreurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const waOk = r.waSuccess ?? r.success;
                      const emOk = r.emailSuccess;
                      const errs = [r.waError, r.emailError, r.error].filter(Boolean).join(" · ");
                      return (
                        <tr key={`${r.phoneNumber ?? r.email ?? i}-${i}`}>
                          <td>{dash(r.name)}</td>
                          <td className="font-monospace small">{dash(r.phoneNumber)}</td>
                          <td className="small">{dash(r.email)}</td>
                          <td>
                            {waOk == null ? (
                              <span className="text-muted">—</span>
                            ) : waOk ? (
                              <span className="badge bg-success-subtle text-success">OK</span>
                            ) : (
                              <span className="badge bg-danger-subtle text-danger">Échec</span>
                            )}
                          </td>
                          <td>
                            {emOk == null ? (
                              <span className="text-muted">—</span>
                            ) : emOk ? (
                              <span className="badge bg-success-subtle text-success">OK</span>
                            ) : (
                              <span className="badge bg-danger-subtle text-danger">Échec</span>
                            )}
                          </td>
                          <td className="small text-muted">{errs || "—"}</td>
                        </tr>
                      );
                    })}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          Aucun résultat
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {resultsTotal > RESULTS_PAGE && (
            <div className="card-footer d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-light"
                disabled={resultsOffset <= 0 || resultsLoading}
                onClick={() =>
                  void loadResults(selectedHistoryId, Math.max(0, resultsOffset - RESULTS_PAGE))
                }
              >
                Précédent
              </button>
              <span className="small text-muted">
                {resultsOffset + 1}–{Math.min(resultsOffset + RESULTS_PAGE, resultsTotal)} /{" "}
                {resultsTotal}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-light"
                disabled={resultsOffset + RESULTS_PAGE >= resultsTotal || resultsLoading}
                onClick={() => void loadResults(selectedHistoryId, resultsOffset + RESULTS_PAGE)}
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Historique des broadcasts</h5>
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
          >
            Actualiser
          </button>
        </div>
        <div className="card-body p-0">
          {historyError && (
            <div className="alert alert-danger m-3 mb-0" role="alert">
              {historyError}
            </div>
          )}
          {historyLoading && history.length === 0 ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Total</th>
                    <th>Envoyés</th>
                    <th>—0choués</th>
                    <th>Créateur</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.map((j) => (
                    <tr
                      key={j.id}
                      className={selectedHistoryId === j.id ? "table-active" : undefined}
                    >
                      <td className="small">{formatDateTime(j.createdAt)}</td>
                      <td>
                        <span className={`badge ${statusBadge(j.status)}`}>{j.status}</span>
                      </td>
                      <td>{j.total}</td>
                      <td className="text-success">{j.sent}</td>
                      <td className="text-danger">{j.failed}</td>
                      <td className="small text-muted">{j.createdBy || "—"}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-subtle-primary"
                          onClick={() => void openHistoryJob(j.id)}
                        >
                          Détail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && !historyLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        Aucun broadcast pour le moment
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
