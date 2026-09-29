"use client";

import { useCallback, useEffect, useState } from "react";
import { searchLeads } from "@/lib/api/leads";
import type { Lead } from "@/lib/api/leads";

/** Autocomplete leads pour les champs client (devis / facture / proposition). */
export function useLeadSuggestions(query: string, enabled = true) {
  const [items, setItems] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setBusy(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setBusy(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setBusy(true);
      void searchLeads(q, 8)
        .then((res) => {
          if (!cancelled) setItems(Array.isArray(res?.items) ? res.items : []);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, enabled]);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return { items, busy, clear };
}
