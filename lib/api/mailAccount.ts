import { api, ApiError } from "@/lib/api/client";

/** Compte mail renvoyé par l’API — jamais le mot de passe. */
export type MailAccount = {
  email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  username: string;
};

export type MailAccountStatus = {
  configured: boolean;
  account?: MailAccount;
};

export type SaveMailAccountBody = MailAccount & {
  /** Omise si vide : le serveur conserve le mot de passe existant. */
  password?: string;
};

export type MailProbeResult = {
  ok: boolean;
  error?: string;
};

export type MailAccountTestResult = {
  smtp: MailProbeResult;
  imap: MailProbeResult;
};

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function asPort(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1) return true;
  if (value === false || value === "false" || value === 0) return false;
  return fallback;
}

function normalizeAccount(raw: unknown): MailAccount | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const email = asString(o.email);
  if (!email) return undefined;
  return {
    email,
    from_name: asString(o.from_name ?? o.fromName),
    smtp_host: asString(o.smtp_host ?? o.smtpHost) || "smtp.titan.email",
    smtp_port: asPort(o.smtp_port ?? o.smtpPort, 465),
    smtp_secure: asBool(o.smtp_secure ?? o.smtpSecure, true),
    imap_host: asString(o.imap_host ?? o.imapHost) || "imap.titan.email",
    imap_port: asPort(o.imap_port ?? o.imapPort, 993),
    imap_secure: asBool(o.imap_secure ?? o.imapSecure, true),
    username: asString(o.username) || email,
  };
}

function normalizeStatus(raw: unknown): MailAccountStatus {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const configured = o.configured === true;
  const account = normalizeAccount(o.account);
  if (!configured || !account) return { configured: false };
  return { configured: true, account };
}

function normalizeProbe(raw: unknown): MailProbeResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const error = asString(o.error);
  return { ok: o.ok === true, ...(error ? { error } : {}) };
}

/** GET /me/mail-account → { configured, account? } */
export async function getMailAccount(): Promise<MailAccountStatus> {
  try {
    const raw = await api.get<unknown>("/me/mail-account");
    return normalizeStatus(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { configured: false };
    throw err;
  }
}

/** PUT /me/mail-account */
export function saveMailAccount(body: SaveMailAccountBody) {
  return api.put<unknown>("/me/mail-account", body);
}

/** POST /me/mail-account/test → { smtp, imap } */
export async function testMailAccount(body: SaveMailAccountBody): Promise<MailAccountTestResult> {
  const raw = await api.post<unknown>("/me/mail-account/test", body);
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    smtp: normalizeProbe(o.smtp),
    imap: normalizeProbe(o.imap),
  };
}

/** DELETE /me/mail-account */
export function deleteMailAccount() {
  return api.delete<void>("/me/mail-account");
}
