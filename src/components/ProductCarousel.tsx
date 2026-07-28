"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { ADDON_PRODUCTS } from "@/lib/gallery-store";
import { ConfigSheet } from "@/components/ConfigSheet";
import type { Job } from "@/lib/asp-parsers";
import { useRouter } from "next/navigation";

const PRODUCT_ACCENTS: Record<string, string> = {
  canvas:    "#8a6a48",
  poster:    "#4a6a4f",
  photobook: "#5a4878",
};

interface Props {
  jobs: Job[];
}

export function ProductCarousel({ jobs }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerProductId, setPickerProductId] = useState<string | null>(null);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  function handleProductClick(productId: string) {
    if (jobs.length === 1) {
      // Jen jedna galerie → přejdi rovnou
      router.push(`/products/${jobs[0].id}?product=${productId}`);
    } else {
      // Více galerií → zobraz picker
      setPickerProductId(productId);
      setPickerOpen(true);
    }
  }

  return (
    <div>
      {/* Section intro — separated from products */}
      <div style={{
        padding: "28px 0 24px",
        borderTop: "1px solid var(--fp-line)",
        borderBottom: "1px solid var(--fp-line)",
        marginBottom: 28,
      }}>
        <h2 style={{
          margin: "0 0 6px",
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontWeight: 400, fontSize: 26, color: "var(--fp-ink)",
        }}>
          Vytvořte <em>vzpomínku</em>
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--fp-ink-3)", maxWidth: 480, lineHeight: 1.6 }}>
          Z vašich fotek můžeme vytvořit krásné produkty — kdykoliv zpětně.
        </p>
      </div>

      {/* Carousel header — navigation arrows */}
      <div className="hidden md:flex" style={{ justifyContent: "flex-end", gap: 6, marginBottom: 12 }}>
        <button onClick={() => scroll(-1)} style={{
          all: "unset", cursor: "pointer",
          width: 32, height: 32,
          border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fp-ink-3)",
        }}><ChevronLeft size={16} /></button>
        <button onClick={() => scroll(1)} style={{
          all: "unset", cursor: "pointer",
          width: 32, height: 32,
          border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fp-ink-3)",
        }}><ChevronRight size={16} /></button>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: 16,
          overflowX: "auto", scrollSnapType: "x mandatory",
          paddingBottom: 8,
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {ADDON_PRODUCTS.map((product) => {
          const accent = PRODUCT_ACCENTS[product.id];

          return (
            <div
              key={product.id}
              style={{
                flexShrink: 0, width: 280, scrollSnapAlign: "start",
                borderRadius: 0,
                border: "1px solid var(--fp-line)",
                background: "var(--fp-surface)",
                overflow: "hidden",
                boxShadow: "var(--fp-shadow-sm)",
                cursor: "pointer",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onClick={() => handleProductClick(product.id)}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "var(--fp-shadow-md)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "var(--fp-shadow-sm)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Visual hero */}
              <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
                {product.id === "canvas" && <CanvasMockup />}
                {product.id === "poster" && <PosterMockup />}
                {product.id === "photobook" && <PhotobookMockup />}

                {/* Price badge */}
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  padding: "4px 10px", borderRadius: 0,
                  background: "rgba(255,255,255,0.92)",
                  fontSize: 11.5, fontWeight: 700, color: accent,
                  backdropFilter: "blur(4px)",
                }}>
                  od {product.priceFrom.toLocaleString("cs-CZ")} Kč
                </div>

                {product.tag && (
                  <div style={{
                    position: "absolute", top: 12, left: 12,
                    padding: "4px 10px", borderRadius: 0,
                    background: accent, color: "#fff",
                    fontSize: 10.5, fontWeight: 600,
                  }}>{product.tag}</div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: "16px 18px 18px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-ink)", marginBottom: 6 }}>
                  {product.name}
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--fp-ink-3)", lineHeight: 1.5 }}>
                  {product.description}
                </p>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12.5, fontWeight: 600, color: accent,
                }}>
                  Vytvořit <ArrowRight size={13} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gallery picker modal */}
      <ConfigSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Z jakého focení?"
      >
        <GalleryPicker
          jobs={jobs}
          productId={pickerProductId ?? ""}
          onSelect={(jobId) => {
            setPickerOpen(false);
            router.push(`/products/${jobId}?product=${pickerProductId}`);
          }}
        />
      </ConfigSheet>
    </div>
  );
}

// ── Product mockup illustrations ───────────────────────────────────────────

function CanvasMockup() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(160deg, #e8ddd0 0%, #d8cfc4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Wall shadow / ambient */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.25) 0%, transparent 70%)" }} />
      {/* Canvas frame */}
      <div style={{
        position: "relative",
        width: 108, height: 80,
        boxShadow: "6px 8px 24px rgba(80,55,30,0.28), 0 2px 6px rgba(0,0,0,0.12)",
      }}>
        {/* Wooden frame border */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, #c4a278 0%, #a07850 40%, #b8926a 60%, #c4a278 100%)",
          borderRadius: 2,
        }} />
        {/* Inner canvas area */}
        <div style={{
          position: "absolute", inset: 8,
          background: "linear-gradient(140deg, #e2c9a8 0%, #c8a882 50%, #b89068 100%)",
          overflow: "hidden",
        }}>
          {/* Photo texture lines */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 8px)",
          }} />
          {/* Light sweep */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, transparent 60%)",
          }} />
        </div>
        {/* Frame edge highlights */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.5)", borderRadius: 0 }} />
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.35)" }} />
      </div>
    </div>
  );
}

function PosterMockup() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(160deg, #d8e2d8 0%, #c8d4c4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.2) 0%, transparent 70%)" }} />
      {/* Poster sheet */}
      <div style={{
        position: "relative",
        width: 78, height: 108,
        background: "#fff",
        boxShadow: "4px 6px 20px rgba(40,60,40,0.22), -1px -1px 0 rgba(0,0,0,0.04)",
        borderRadius: 1,
      }}>
        {/* Slight paper texture */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.0) 0%, rgba(220,230,220,0.3) 100%)" }} />
        {/* Photo area top */}
        <div style={{
          position: "absolute", top: 6, left: 6, right: 6, height: 70,
          background: "linear-gradient(140deg, #c8d8c0 0%, #a8c0a0 50%, #90ac88 100%)",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 7px)",
          }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 55%)" }} />
        </div>
        {/* Text lines */}
        <div style={{ position: "absolute", bottom: 12, left: 8, right: 8 }}>
          <div style={{ height: 4, background: "#d4d4d0", borderRadius: 2, marginBottom: 4 }} />
          <div style={{ height: 3, background: "#e0e0dc", borderRadius: 2, width: "60%" }} />
        </div>
        {/* Page edge shadow */}
        <div style={{ position: "absolute", top: 0, right: -2, bottom: 0, width: 2, background: "rgba(0,0,0,0.06)" }} />
      </div>
      {/* Second poster slightly behind */}
      <div style={{
        position: "absolute",
        width: 78, height: 108,
        background: "#f8f8f6",
        boxShadow: "2px 4px 12px rgba(0,0,0,0.12)",
        transform: "rotate(5deg) translate(36px, 2px)",
        borderRadius: 1,
        zIndex: 0,
      }} />
    </div>
  );
}

function PhotobookMockup() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(160deg, #ddd8e8 0%, #ccc4d8 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.2) 0%, transparent 70%)" }} />
      {/* Book body */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Pages stack (right side) */}
        <div style={{
          position: "absolute", top: 2, left: 14, right: -2, bottom: -2,
          background: "linear-gradient(90deg, #e8e4e0 0%, #f0ece8 40%, #e8e4e0 100%)",
          borderRadius: "0 2px 2px 0",
          boxShadow: "2px 2px 8px rgba(0,0,0,0.12)",
        }}>
          {/* Page lines */}
          {[10, 18, 26, 34, 42, 50, 58, 66, 74, 82].map(t => (
            <div key={t} style={{ position: "absolute", top: t, left: 2, right: 2, height: 0.5, background: "rgba(0,0,0,0.06)" }} />
          ))}
        </div>
        {/* Hard cover */}
        <div style={{
          position: "relative",
          width: 90, height: 96,
          background: "linear-gradient(135deg, #7060a8 0%, #584888 40%, #6858a0 100%)",
          borderRadius: 0,
          boxShadow: "4px 6px 20px rgba(60,40,100,0.3), -1px 0 0 rgba(0,0,0,0.15)",
        }}>
          {/* Cover sheen */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 55%)", borderRadius: 0 }} />
          {/* Spine line */}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 8, background: "rgba(0,0,0,0.15)", borderRadius: 0 }} />
          {/* Photo preview window on cover */}
          <div style={{
            position: "absolute", top: 14, left: 16, right: 12, height: 46,
            background: "linear-gradient(140deg, #c4b0d8 0%, #a898c0 50%, #9080b0 100%)",
            borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 7px)",
            }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, transparent 55%)" }} />
          </div>
          {/* Title line */}
          <div style={{ position: "absolute", bottom: 14, left: 16, right: 12, height: 3, background: "rgba(255,255,255,0.35)", borderRadius: 2 }} />
          <div style={{ position: "absolute", bottom: 9, left: 16, width: "40%", height: 2, background: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

// ── Gallery picker ──────────────────────────────────────────────────────────

function GalleryPicker({ jobs, productId, onSelect }: {
  jobs: Job[];
  productId: string;
  onSelect: (jobId: string) => void;
}) {
  const product = ADDON_PRODUCTS.find((p) => p.id === productId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--fp-ink-3)", lineHeight: 1.55 }}>
        Vyberte focení, ze kterého chcete {product?.name.toLowerCase() ?? "produkt"} vytvořit.
      </p>
      {jobs.map((job) => (
        <button key={job.id} onClick={() => onSelect(job.id)} style={{
          all: "unset", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderRadius: 0,
          border: "1.5px solid var(--fp-line)", background: "var(--fp-bg)",
          transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--fp-accent)"; e.currentTarget.style.background = "var(--fp-accent-soft)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--fp-line)"; e.currentTarget.style.background = "var(--fp-bg)"; }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fp-ink)" }}>{job.title || `Zakázka #${job.id}`}</div>
            {job.date && (
              <div style={{ fontSize: 12, color: "var(--fp-ink-3)", marginTop: 2 }}>
                {new Date(job.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
          <ChevronRight size={18} style={{ color: "var(--fp-ink-3)", flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}
