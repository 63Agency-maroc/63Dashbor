"use client";

import { useEffect } from "react";

/**
 * Charge le bundle Bootstrap 5.3 (dropdowns, modals, tabs, tooltips)
 * via data-bs-* — même markup que le template, sans jQuery.
 *
 * Choix documenté : data-attributes + bootstrap.bundle plutôt que react-bootstrap,
 * pour garder le HTML NexLink au pixel près.
 */
export function BootstrapClient() {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const bootstrap = await import("bootstrap");
      if (cancelled) return;

      // Tooltips (rail icônes sidebar)
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
        bootstrap.Tooltip.getOrCreateInstance(el);
      });
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
