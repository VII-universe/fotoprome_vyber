"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ConfigSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet on mobile, slide-over panel on desktop.
 * CSS transitions only — no framer-motion dependency.
 */
export function ConfigSheet({ open, onClose, title, children }: ConfigSheetProps) {
  const isMobile = useIsMobile();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(28,26,23,0.55)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          zIndex: 101,
          background: "var(--fp-surface)",
          boxShadow: "0 -8px 40px rgba(28,26,23,0.18)",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
          ...(isMobile ? {
            // Bottom sheet on mobile
            bottom: 0, left: 0, right: 0,
            borderRadius: 0,
            maxHeight: "92dvh",
            transform: open ? "translateY(0)" : "translateY(100%)",
          } : {
            // Slide-over on desktop
            top: 0, right: 0, bottom: 0,
            width: 520,
            borderRadius: 0,
            transform: open ? "translateX(0)" : "translateX(100%)",
          }),
        }}
      >
        {/* Drag handle (mobile only) */}
        {isMobile && (
          <div style={{
            width: 36, height: 4, borderRadius: 0,
            background: "var(--fp-line)",
            margin: "12px auto 0",
            flexShrink: 0,
          }} />
        )}

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "14px 20px 12px" : "20px 24px 16px",
          borderBottom: "1px solid var(--fp-line)",
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontWeight: 400, fontSize: isMobile ? 22 : 26,
            color: "var(--fp-ink)",
          }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer",
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--fp-bg)",
              color: "var(--fp-ink-3)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--fp-line)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--fp-bg)")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: isMobile ? "20px 20px 40px" : "24px 24px 40px",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </>
  );
}
