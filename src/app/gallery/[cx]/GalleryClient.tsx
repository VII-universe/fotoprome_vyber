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
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

export function GalleryClient({ cx }: { cx: string }) {
  const { step, setJobId, setPhotos } = useGalleryStore();
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const isMobile = useIsMobile();

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

  return (
    <AppShell>
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
