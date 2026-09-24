"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { French } from "flatpickr/dist/l10n/fr.js";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import "flatpickr/dist/flatpickr.min.css";

type Props = {
  /** Valeur interne YYYY-MM-DD (Casablanca civil) */
  value: string;
  onChange: (ymd: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Un seul input Date + calendrier Flatpickr.
 * Affichage FR d/m/Y ; onChange renvoie Y-m-d pour la soumission UTC.
 * Pas d’altInput (évite le double champ).
 */
export function CasablancaDatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "jj/mm/aaaa",
  id,
  className = "form-control",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fpRef = useRef<FlatpickrInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    if (fpRef.current) {
      fpRef.current.destroy();
      fpRef.current = null;
    }

    const fp = flatpickr(el, {
      locale: French,
      // Un seul champ visible — format affiché
      dateFormat: "d/m/Y",
      altInput: false,
      allowInput: false,
      clickOpens: true,
      disableMobile: true,
      monthSelectorType: "dropdown",
      onChange: (dates) => {
        if (!dates[0]) {
          onChangeRef.current("");
          return;
        }
        // Valeur canonique YYYY-MM-DD pour date + heure → UTC
        onChangeRef.current(flatpickr.formatDate(dates[0], "Y-m-d"));
      },
      onReady: (_dates, _str, instance) => {
        instance.calendarContainer.style.zIndex = "2000";
      },
    });

    fpRef.current = fp;

    if (value) {
      fp.setDate(value, false, "Y-m-d");
    }

    return () => {
      fp.destroy();
      fpRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per mount
  }, []);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    const selected = fp.selectedDates[0];
    const currentYmd = selected ? flatpickr.formatDate(selected, "Y-m-d") : "";
    if (value && value !== currentYmd) {
      fp.setDate(value, false, "Y-m-d");
    } else if (!value && currentYmd) {
      fp.clear();
    }
  }, [value]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    if (disabled) fp.input.setAttribute("disabled", "disabled");
    else fp.input.removeAttribute("disabled");
  }, [disabled]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className}
      placeholder={placeholder}
      readOnly
      disabled={disabled}
      autoComplete="off"
    />
  );
}
