"use client";

import { useGalleryStore, type GalleryStep } from "@/lib/gallery-store";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1 as GalleryStep, label: "Výběr fotek" },
  { id: 2 as GalleryStep, label: "Parametry" },
  // { id: 3 as GalleryStep, label: "Doplňky" }, // skryt — reaktivovat spolu s CrossSellStep
  { id: 4 as GalleryStep, label: "Rekapitulace" },
] as const;

export function StepIndicator({ currentStep }: { currentStep: GalleryStep }) {
  const { setStep } = useGalleryStore();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {STEPS.map((step, i) => {
        const isDone = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              onClick={() => isDone && setStep(step.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                opacity: isDone || isCurrent ? 1 : 0.4,
                cursor: isDone ? "pointer" : "default",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isDone ? "var(--fp-ink)" : (isCurrent ? "var(--fp-accent)" : "transparent"),
                border: (!isDone && !isCurrent) ? "1px solid var(--fp-ink-4)" : "none",
                color: (isDone || isCurrent) ? "#fff" : "var(--fp-ink-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
              }}>
                {isDone ? <Check size={11} strokeWidth={2.5} /> : step.id}
              </div>
              <span style={{
                fontSize: 12.5, fontWeight: 500,
                color: isCurrent ? "var(--fp-ink)" : "var(--fp-ink-3)",
              }} className="hidden sm:inline">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 24, height: 1, background: step.id < currentStep ? "var(--fp-ink-3)" : "var(--fp-line)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
