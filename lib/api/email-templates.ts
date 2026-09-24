import { api, ApiError } from "@/lib/api/client";

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
