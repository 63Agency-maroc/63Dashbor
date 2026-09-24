import { API_BASE_URL } from "@/lib/api/config";
import { clearSession, getToken } from "@/lib/auth/storage";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "signal"> & {
  body?: unknown;
  /** Skip Authorization header (ex. login) */
  skipAuth?: boolean;
  /** Skip 401 → redirect (ex. /auth/me pendant bootstrap) */
  skipAuthRedirect?: boolean;
  /** Timeout ms (AbortController) — ex. sync ClickUp longue */
  timeoutMs?: number;
};

function extractMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (Array.isArray(obj.message)) return obj.message.map(String).join(", ");
  if (typeof obj.error === "string") return obj.error;
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, skipAuthRedirect, timeoutMs, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers,
      body: body === undefined || body instanceof FormData ? (body as BodyInit | undefined) : JSON.stringify(body),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      throw new ApiError("Délai d’attente dépassé. Réessayez.", 0);
    }
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion ou l’API.", 0);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (res.status === 401) {
    clearSession();
    if (!skipAuthRedirect && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError(extractMessage(data, "Session expirée. Veuillez vous reconnecter."), 401, data);
  }

  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Erreur ${res.status}`), res.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
