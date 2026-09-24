import { api } from "@/lib/api/client";

export type BroadcastChannels = {
  whatsapp?: boolean;
  email?: boolean;
};

/** Destinataire multi-canal */
export type BroadcastRecipient = {
  phoneNumber?: string;
  email?: string;
  /** Perso WA {{1}} / email {{name}} — fallback backend "Client" */
  name?: string;
  /** Legacy WA-only */
  variable1?: string;
};

export type BroadcastComponentParameter = {
  type: "text";
  text: string;
};

export type BroadcastComponent = {
  type: "body";
  parameters: BroadcastComponentParameter[];
};

/**
 * POST /whatsapp/broadcast (202) — canaux WA et/ou email
 */
export type CreateBroadcastDto = {
  channels: BroadcastChannels;
  recipients: BroadcastRecipient[];
  /** Requis si channels.whatsapp */
  templateName?: string;
  templateLanguage?: string;
  /** Requis si channels.email */
  emailSubject?: string;
  emailHtml?: string;
  /** Legacy */
  phoneNumbers?: string[];
  variable1?: string;
  components?: BroadcastComponent[];
};

export type BroadcastJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export type BroadcastJobSummary = {
  id: string;
  status: BroadcastJobStatus;
  total: number;
  sent: number;
  failed: number;
  waSent?: number;
  waFailed?: number;
  emailSent?: number;
  emailFailed?: number;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type BroadcastMessageConfig = {
  templateName?: string;
  templateLanguage?: string;
  channels?: BroadcastChannels;
  emailSubject?: string;
  emailHtml?: string;
  recipients?: BroadcastRecipient[];
  [key: string]: unknown;
};

export type BroadcastJobDetail = {
  id: string;
  status: BroadcastJobStatus;
  total: number;
  sent: number;
  failed: number;
  waSent?: number;
  waFailed?: number;
  emailSent?: number;
  emailFailed?: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  messageConfig: BroadcastMessageConfig | null;
  createdBy: string | null;
};

export type BroadcastCreateResponse = {
  jobId: string;
  total: number;
  status: BroadcastJobStatus;
};

export type BroadcastResultItem = {
  phoneNumber?: string | null;
  email?: string | null;
  name?: string | null;
  /** Legacy mono-canal */
  success?: boolean;
  error?: string | null;
  waSuccess?: boolean | null;
  waError?: string | null;
  emailSuccess?: boolean | null;
  emailError?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
};

export type BroadcastResultsPage = {
  items: BroadcastResultItem[];
  total: number;
};

export type BroadcastCancelResponse = {
  ok: boolean;
  id: string;
  status: BroadcastJobStatus;
};

export type BroadcastProgressEvent = {
  jobId: string;
  status: BroadcastJobStatus;
  total: number;
  sent?: number;
  failed?: number;
  waSent?: number;
  waFailed?: number;
  emailSent?: number;
  emailFailed?: number;
};

export type BroadcastDoneEvent = BroadcastProgressEvent & {
  error?: string | null;
};

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** 202 Accepted — job async */
export function createBroadcast(dto: CreateBroadcastDto) {
  return api.post<BroadcastCreateResponse>("/whatsapp/broadcast", dto);
}

export function listBroadcasts() {
  return api.get<{ items: BroadcastJobSummary[] }>("/whatsapp/broadcast");
}

export function getBroadcast(jobId: string) {
  return api.get<BroadcastJobDetail>(`/whatsapp/broadcast/${encodeURIComponent(jobId)}`);
}

export function getBroadcastResults(
  jobId: string,
  params: { limit?: number; offset?: number } = {},
) {
  return api.get<BroadcastResultsPage>(
    `/whatsapp/broadcast/${encodeURIComponent(jobId)}/results${buildQuery({
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export function cancelBroadcast(jobId: string) {
  return api.post<BroadcastCancelResponse>(
    `/whatsapp/broadcast/${encodeURIComponent(jobId)}/cancel`,
  );
}

export function isBroadcastActive(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "queued" || s === "running" || s === "pending" || s === "processing";
}
