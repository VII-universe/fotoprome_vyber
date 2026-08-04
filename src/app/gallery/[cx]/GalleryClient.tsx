"use client";

import { useEffect, useRef, useState } from "react";
import { useGalleryStore } from "@/lib/gallery-store";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StepIndicator } from "./StepIndicator";
import { DreamboxStep } from "./DreamboxStep";
import { ConfiguratorStep } from "./ConfiguratorStep";
// import { CrossSellStep } from "./CrossSellStep"; // krok 3 doplňků — skryt, zakomentovat pro reaktivaci
import { SummaryStep } from "./SummaryStep";
import { VyberPanel } from "./VyberPanel";
import { Loader2, ShoppingBag } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

export function GalleryClient({ cx }: { cx: string }) {
  const { step, setJobId, setPhotos, dreambox } = useGalleryStore();
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const initialized = useRef(false);
  const isMobile = useIsMobile();

  const dreamboxCount = dreambox.size;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setJobId(cx);
    fetch(`/api/gallery?cx=${cx}&act=all`)
      .then((r) => r.json())
      .then((d) => { if (d.error) toast.error(d.error); else setPhotos(d.photos ?? []); })
      .catch(() => toast.error("Nepodařilo se načíst fotky"))
      .finally(() => setLoading(false));
  }, [cx, setJobId, setPhotos]);

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, gap: 16 }}>
          <Loader2 size={36} style={{ color: "var(--fp-accent)", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "var(--fp-ink-3)", fontSize: 14 }}>Načítám fotky…</p>
        </div>
      </AppShell>
    );
  }

  const vyberButton = (
    <button
      onClick={() => setPanelOpen(true)}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 14px",
        border: "1px solid var(--fp-line)",
        fontSize: 12, fontWeight: 600,
        letterSpacing: "0.05em", textTransform: "uppercase",
        color: "var(--fp-ink)",
        background: dreamboxCount > 0 ? "var(--fp-ink)" : "transparent",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        if (dreamboxCount === 0) (e.currentTarget as HTMLButtonElement).style.background = "var(--fp-surface)";
      }}
      onMouseLeave={e => {
        if (dreamboxCount === 0) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <ShoppingBag size={13} color={dreamboxCount > 0 ? "#fff" : undefined} />
      <span style={{ color: dreamboxCount > 0 ? "#fff" : undefined }}>Výběr</span>
      {dreamboxCount > 0 && (
        <span style={{
          background: "rgba(255,255,255,0.25)",
          color: "#fff",
          fontSize: 10, fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 20,
          letterSpacing: 0,
          fontFamily: "ui-monospace, monospace",
        }}>
          {dreamboxCount}
        </span>
      )}
    </button>
  );

  return (
    <AppShell navExtra={vyberButton}>
      <VyberPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px" : "24px 48px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: "var(--fp-ink-3)", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <a href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Přehled</a>
          <span>›</span>
          <span style={{ color: "var(--fp-ink)" }}>Focení #{cx}</span>
        </div>

        <StepIndicator currentStep={step} />

        <div style={{ marginTop: 24 }}>
          {step === 1 && <DreamboxStep cx={cx} />}
          {step === 2 && <ConfiguratorStep cx={cx} />}
          {/* {step === 3 && <CrossSellStep cx={cx} />} */}
          {step === 4 && <SummaryStep cx={cx} />}
        </div>
      </div>
    </AppShell>
  );
}
