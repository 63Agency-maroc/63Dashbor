import { api } from "@/lib/api/client";

export type UploadKind = "image" | "video" | "raw";

export type UploadResult = {
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

function extractUrl(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string" && data.startsWith("http")) return data;
  if (typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const key of ["url", "secureUrl", "secure_url", "mediaUrl"]) {
    if (typeof o[key] === "string" && (o[key] as string).startsWith("http")) return o[key] as string;
  }
  if (o.data && typeof o.data === "object") return extractUrl(o.data);
  return null;
}

/**
 * Upload Cloudinary via API Nest :
 * POST /upload/image | /upload/video | /upload/raw (FormData)
 */
export async function uploadFile(file: File, kind: UploadKind): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const data = await api.post<unknown>(`/upload/${kind}`, form);
  const url = extractUrl(data);
  if (!url) {
    throw new Error("Réponse upload invalide (URL manquante).");
  }
  return {
    url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || undefined,
  };
}

/** POST /upload/image → secureUrl (avatar profil, etc.) */
export async function uploadImage(file: File): Promise<UploadResult> {
  return uploadFile(file, "image");
}

export function uploadKindForFile(file: File): UploadKind {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  return "raw";
}

export function mediaTypeForUpload(kind: UploadKind): "image" | "video" | "document" {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  return "document";
}
