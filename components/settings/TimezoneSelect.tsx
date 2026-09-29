"use client";

import { useMemo, useState } from "react";
import { COUNTRY_TIMEZONES, labelForTimezone } from "@/lib/calendar/countryTimezones";
import { detectBrowserTimezone, isValidIanaTimeZone } from "@/lib/datetime/timezone";

type Props = {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
};

/** Dropdown fuseau IANA avec recherche (thème app). */
export function TimezoneSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const browser = detectBrowserTimezone();
    const base = [...COUNTRY_TIMEZONES];
    if (browser && !base.some((c) => c.timezone === browser)) {
      base.unshift({ country: "Navigateur", timezone: browser });
    }
    if (value && isValidIanaTimeZone(value) && !base.some((c) => c.timezone === value)) {
      base.unshift({ country: value.split("/").pop()?.replace(/_/g, " ") || value, timezone: value });
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.country.toLowerCase().includes(q) ||
        c.timezone.toLowerCase().includes(q) ||
        labelForTimezone(c.timezone).toLowerCase().includes(q),
    );
  }, [query, value]);

  const currentLabel = labelForTimezone(value || detectBrowserTimezone());

  return (
    <div className="position-relative" style={{ maxWidth: 420 }}>
      <button
        type="button"
        className="btn btn-white dropdown-toggle w-100 text-start d-flex align-items-center justify-content-between"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-truncate">{currentLabel}</span>
      </button>
      {open ? (
        <div
          className="dropdown-menu show shadow w-100 p-2"
          style={{
            maxHeight: 320,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 1050,
            position: "absolute",
          }}
        >
          <input
            type="search"
            className="form-control form-control-sm mb-2"
            placeholder="Rechercher un pays / fuseau…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div style={{ overflowY: "auto", flex: 1 }}>
            {options.length === 0 ? (
              <div className="dropdown-item disabled small text-muted">Aucun résultat</div>
            ) : (
              options.map((c) => {
                const active = c.timezone === value;
                return (
                  <button
                    key={c.timezone}
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between${active ? " active" : ""}`}
                    onClick={() => {
                      onChange(c.timezone);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>
                      {c.country}
                      <span className="small text-muted d-block">{c.timezone}</span>
                    </span>
                    {active ? <i className="fi fi-rr-check" aria-hidden /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
      {open ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1 }}
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
