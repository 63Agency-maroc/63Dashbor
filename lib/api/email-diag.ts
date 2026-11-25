import { api } from "@/lib/api/client";

export type EmailDiagMode = "RAW" | "FULL";

export type EmailDiagDto = {
  to: string;
  mode: EmailDiagMode;
};

/** POST /email/diag — admin diagnostic (RAW / FULL). */
export function postEmailDiag(dto: EmailDiagDto) {
  return api.post<unknown>("/email/diag", dto);
}
