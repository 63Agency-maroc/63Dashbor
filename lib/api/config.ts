/**
 * Config API NestJS — base URL côté client.
 * Définir NEXT_PUBLIC_API_URL dans .env.local (voir .env.example).
 */
export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")) ||
  "http://localhost:3002";
