"use client";

/**
 * Development-only age-band override switcher.
 *
 * Renders a floating widget that lets developers cycle through age-band
 * palettes without touching the database. It directly updates the
 * data-age-band attribute on the app shell element (#app-shell), which
 * causes the CSS variable overrides in globals.css to take effect
 * immediately — same mechanism as the real server-rendered value.
 *
 * State is stored in localStorage under "pace-dev-age-band-override" and
 * restored on mount so it survives page reloads during a dev session.
 *
 * This file is NEVER imported in production: the layout wraps the import
 * in `process.env.NODE_ENV !== 'production'` so the module is tree-shaken.
 */

import { useEffect, useState } from "react";
import type { AgeBand } from "@/lib/personalization/age-band";

const BANDS: { value: AgeBand; label: string; hex: string }[] = [
  { value: "junior",       label: "Junior",       hex: "#5b21b6" },
  { value: "intermediate", label: "Intermediate", hex: "#1d4ed8" },
  { value: "senior",       label: "Senior",       hex: "#23422a" },
  { value: "university",   label: "University",   hex: "#334155" },
  { value: "adult",        label: "Adult",        hex: "#1e3a5f" },
];

const STORAGE_KEY = "pace-dev-age-band-override";
const SHELL_ID    = "app-shell";

function applyToShell(band: AgeBand | null, fallback?: string) {
  const el = document.getElementById(SHELL_ID);
  if (!el) return;
  if (band) {
    el.setAttribute("data-age-band", band);
  } else if (fallback) {
    el.setAttribute("data-age-band", fallback);
  } else {
    el.removeAttribute("data-age-band");
  }
}

export function AgeBandDevSwitcher({ realBand }: { realBand?: string }) {
  const [open, setOpen]         = useState(false);
  const [override, setOverride] = useState<AgeBand | null>(null);

  // Restore any saved override on first mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AgeBand | null;
      if (stored && BANDS.some((b) => b.value === stored)) {
        setOverride(stored);
        applyToShell(stored, realBand);
      }
    } catch {
      // localStorage may be unavailable in some environments — ignore.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(band: AgeBand | null) {
    setOverride(band);
    try {
      if (band) {
        localStorage.setItem(STORAGE_KEY, band);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    applyToShell(band, realBand);
    setOpen(false);
  }

  const activeValue = override ?? (realBand as AgeBand | undefined);
  const activeBand  = BANDS.find((b) => b.value === activeValue);
  const dotColor    = activeBand?.hex ?? "#9ca3af";
  const isOverride  = override !== null;

  // Use only inline styles so the switcher is immune to the theme palette
  // changes it controls — a bg-primary button would shift colour on each click.
  const base: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 500,
  };

  return (
    <div
      style={{
        ...base,
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9999,
      }}
    >
      {/* Band picker panel */}
      {open && (
        <div
          style={{
            marginBottom: 8,
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 180,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <p style={{ color: "#9ca3af", marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 10 }}>
            Age band (dev override)
          </p>

          {BANDS.map((b) => {
            const isActive = activeValue === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => select(b.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isActive ? "#ffffff" : "#d1d5db",
                  textAlign: "left",
                  fontFamily: base.fontFamily,
                  fontSize: base.fontSize,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: b.hex,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 2px rgba(255,255,255,0.4)` : "none",
                  }}
                />
                {b.label}
                {b.value === (realBand as AgeBand | undefined) && !isOverride && (
                  <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>real</span>
                )}
                {b.value === (realBand as AgeBand | undefined) && isOverride && (
                  <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 10 }}>real</span>
                )}
              </button>
            );
          })}

          {isOverride && (
            <button
              type="button"
              onClick={() => select(null)}
              style={{
                marginTop: 4,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #374151",
                background: "transparent",
                color: "#f87171",
                cursor: "pointer",
                fontFamily: base.fontFamily,
                fontSize: base.fontSize,
                textAlign: "left",
              }}
            >
              ↩ Reset to real profile
            </button>
          )}
        </div>
      )}

      {/* Floating trigger pill */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 20,
          border: "1px solid #374151",
          background: "#1f2937",
          color: "#e5e7eb",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          fontFamily: base.fontFamily,
          fontSize: base.fontSize,
          fontWeight: base.fontWeight,
        }}
        title="Dev: switch age band"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        {activeBand?.label ?? "none"}
        {isOverride && (
          <span style={{ color: "#f59e0b", fontSize: 10 }}>DEV</span>
        )}
        <span style={{ color: "#6b7280", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}
