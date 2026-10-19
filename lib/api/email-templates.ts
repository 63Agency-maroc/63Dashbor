import { api, ApiError } from "@/lib/api/client";

export type EmailTemplate = {
  id: string;
  waTemplateName: string;
  subject: string;
  htmlBody: string;
};

export type EmailTemplateMapping = {
  subject: string;
  htmlBody: string;
};

export type SaveEmailTemplateMappingDto = {
  subject: string;
  /** snake_case côté API */
  html_body: string;
};

type EmailTemplateApiResponse = {
  subject?: string;
  htmlBody?: string;
  html_body?: string;
};

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeTemplate(raw: unknown): EmailTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const waTemplateName = asText(row.waTemplateName ?? row.wa_template_name).trim();
  const subject = asText(row.subject);
  const htmlBody = asText(row.htmlBody ?? row.html_body);
  const id = asText(row.id).trim() || waTemplateName;
  if (!id) return null;
  return { id, waTemplateName, subject, htmlBody };
}

function pickTemplateList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const row = raw as Record<string, unknown>;
  for (const key of ["templates", "items", "data"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

/** GET /email/templates — [{ id, wa_template_name, subject, html_body }] */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const raw = await api.get<unknown>("/email/templates");
  return pickTemplateList(raw)
    .map(normalizeTemplate)
    .filter((item): item is EmailTemplate => Boolean(item));
}

function normalizeMapping(raw: EmailTemplateApiResponse | null | undefined): EmailTemplateMapping | null {
  if (!raw || typeof raw !== "object") return null;
  const subject = typeof raw.subject === "string" ? raw.subject : "";
  const htmlBody =
    typeof raw.htmlBody === "string"
      ? raw.htmlBody
      : typeof raw.html_body === "string"
        ? raw.html_body
        : "";
  if (!subject && !htmlBody) return null;
  return { subject, htmlBody };
}

/** GET /email/templates/:waTemplateName — 404 → null */
export async function getEmailTemplateMapping(
  waTemplateName: string,
): Promise<EmailTemplateMapping | null> {
  const name = waTemplateName.trim();
  if (!name) return null;
  try {
    const res = await api.get<EmailTemplateApiResponse>(
      `/email/templates/${encodeURIComponent(name)}`,
    );
    return normalizeMapping(res);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** PUT /email/templates/:waTemplateName — admin only */
export function saveEmailTemplateMapping(
  waTemplateName: string,
  dto: SaveEmailTemplateMappingDto,
) {
  return api.put<EmailTemplateApiResponse>(
    `/email/templates/${encodeURIComponent(waTemplateName.trim())}`,
    dto,
  );
}
