"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ADDON_PRODUCTS, type AddonProductId, type AddonItem } from "@/lib/gallery-store";
import { ConfigSheet } from "@/components/ConfigSheet";
import { FrameIcon, Printer, BookOpen, Check, Sparkles, ArrowLeft, Send, Loader2 } from "lucide-react";
import type { GalleryPhoto } from "@/lib/asp-parsers";
import { useIsMobile } from "@/hooks/useIsMobile";

const BASE = "https://v1.fotoprome.cz";

const PRODUCT_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  canvas: FrameIcon, poster: Printer, photobook: BookOpen,
};

const PRODUCT_VISUALS: Record<string, { bg: string; accent: string }> = {
  canvas:    { bg: "linear-gradient(135deg, #e8d5c0, #d4c0a8)", accent: "#8a6a48" },
  poster:    { bg: "linear-gradient(135deg, #d8e0d0, #c4ceb8)", accent: "#4a6a4f" },
  photobook: { bg: "linear-gradient(135deg, #d8d0e8, #c4b8d4)", accent: "#5a4878" },
};

export function ProductConfigClient({ cx, initialProduct }: { cx: string; initialProduct: string | null }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuringId, setConfiguringId] = useState<AddonProductId | null>(
    (initialProduct as AddonProductId) ?? null
  );
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetch(`/api/gallery?cx=${cx}&act=all`)
      .then(r => r.json())
      .then(d => { if (!d.error) setPhotos(d.photos ?? []); })
      .catch(() => toast.error("Nepodařilo se načíst fotky"))
      .finally(() => setLoading(false));
  }, [cx]);

  const configuringProduct = ADDON_PRODUCTS.find(p => p.id === configuringId);
  const existing = addons.find(a => a.productId === configuringId);

  async function handleSubmit() {
    if (addons.length === 0) { toast.error("Vyberte alespoň jeden produkt"); return; }
    setSubmitting(true);
    try {
      // Send as order comment/note to backend (products are handled manually by photographer)
      const summary = addons.map(a => {
        const product = ADDON_PRODUCTS.find(p => p.id === a.productId);
        const variant = product?.variants.find(v => v.id === a.variantId);
        return `${product?.name}: ${variant?.label}, ${a.photoIds.length} fotek`;
      }).join("; ");

      await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cx, delivery: 1, paper: 1, coupon: "", globalComments: `DOPLŇKOVÉ PRODUKTY: ${summary}` }),
      });
      setDone(true);
    } catch {
      toast.error("Odeslání se nezdařilo");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ width: 72, height: 72, background: "#e3ebe2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Check size={36} style={{ color: "#4a6a4f" }} strokeWidth={2.5} />
        </div>
        <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 32, margin: "0 0 10px" }}>
          Poptávka odeslána!
        </h2>
        <p style={{ color: "var(--fp-ink-3)", fontSize: 15, lineHeight: 1.6 }}>
          Fotograf vás brzy kontaktuje s detaily vaší objednávky.
        </p>
        <button onClick={() => router.push("/dashboard")} style={{
          all: "unset", cursor: "pointer", marginTop: 28,
          height: 44, padding: "0 24px", borderRadius: 0,
          border: "1px solid var(--fp-line)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fp-ink)",
          display: "inline-flex", alignItems: "center",
        }}>
          ← Zpět na přehled
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px" : "24px 48px", paddingBottom: 100 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--fp-ink-3)", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        <a href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Přehled</a>
        <span>›</span>
        <span style={{ color: "var(--fp-ink)" }}>Produkty z focení #{cx}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>
          Focení #{cx}
        </div>
        <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: isMobile ? 28 : 38, color: "var(--fp-ink)" }}>
          Vytvořit <em>produkt</em>
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--fp-ink-3)" }}>
          Vyberte produkty a přiřaďte k nim fotografie z tohoto focení.
        </p>
      </div>

      {/* Product grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {ADDON_PRODUCTS.map(product => {
          const addon = addons.find(a => a.productId === product.id);
          const variant = product.variants.find(v => v.id === addon?.variantId);
          const Icon = PRODUCT_ICONS[product.id];
          const visual = PRODUCT_VISUALS[product.id];

          return (
            <div key={product.id} style={{
              border: addon ? "2px solid var(--fp-ink)" : "1px solid var(--fp-line)",
              background: "var(--fp-surface)",
              overflow: "hidden",
              transition: "border-color 0.15s",
            }}>
              {/* Hero */}
              <div style={{ height: 120, background: visual.bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 10px)", position: "absolute", inset: 0 }} />
                <div style={{ width: 60, height: 60, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={28} strokeWidth={1.2} />
                </div>
                {addon && (
                  <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, background: "var(--fp-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={13} strokeWidth={3} style={{ color: "#fff" }} />
                  </div>
                )}
                {product.tag && (
                  <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", background: visual.accent, color: "#fff", fontSize: 10, fontWeight: 600 }}>{product.tag}</div>
                )}
              </div>

              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-ink)" }}>{product.name}</div>
                {addon && variant && (
                  <div style={{ fontSize: 12, color: "var(--fp-accent)", fontWeight: 500, marginTop: 3 }}>
                    {variant.label} · {addon.photoIds.length} fotek · {addon.price.toLocaleString("cs-CZ")} Kč
                  </div>
                )}
                <p style={{ margin: "8px 0 14px", fontSize: 12, color: "var(--fp-ink-3)", lineHeight: 1.5 }}>{product.description}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {addon ? (
                    <>
                      <button onClick={() => setAddons(prev => prev.filter(a => a.productId !== product.id))} style={{
                        all: "unset", cursor: "pointer", height: 32, padding: "0 12px", borderRadius: 0,
                        background: "var(--fp-bg)", border: "1px solid var(--fp-line)", fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fp-ink-3)",
                      }}>Odebrat</button>
                      <button onClick={() => setConfiguringId(product.id as AddonProductId)} style={{
                        all: "unset", cursor: "pointer", height: 32, padding: "0 12px", borderRadius: 0,
                        background: "var(--fp-ink)", border: "1px solid var(--fp-ink)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fp-bg)",
                      }}>Upravit</button>
                    </>
                  ) : (
                    <button onClick={() => setConfiguringId(product.id as AddonProductId)} style={{
                      all: "unset", cursor: "pointer", height: 32, padding: "0 14px", borderRadius: 0,
                      background: "var(--fp-ink)", color: "var(--fp-bg)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      + Přidat
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary + submit */}
      {addons.length > 0 && (
        <div style={{
          padding: "20px 24px", borderRadius: 0,
          background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
          marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--fp-ink-3)", marginBottom: 4 }}>Celková poptávka</div>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 26 }}>
              {addons.reduce((s, a) => s + a.price, 0).toLocaleString("cs-CZ")} Kč
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting} style={{
            all: "unset", cursor: submitting ? "not-allowed" : "pointer",
            height: 48, padding: "0 24px", borderRadius: 0,
            background: "var(--fp-accent)", color: "#fff",
            fontSize: 15, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} strokeWidth={2} />}
            Odeslat poptávku fotografovi
          </button>
        </div>
      )}

      {/* Config sheet */}
      {configuringProduct && !loading && (
        <ConfigSheet open={configuringId !== null} onClose={() => setConfiguringId(null)} title={configuringProduct.name}>
          <StandaloneProductConfig
            product={configuringProduct}
            photos={photos}
            existing={existing}
            onConfirm={item => { setAddons(prev => [...prev.filter(a => a.productId !== item.productId), item]); setConfiguringId(null); }}
          />
        </ConfigSheet>
      )}
    </div>
  );
}

// ── Standalone config (same logic as CrossSellStep but with all gallery photos) ──

function StandaloneProductConfig({ product, photos, existing, onConfirm }: {
  product: typeof ADDON_PRODUCTS[0];
  photos: GalleryPhoto[];
  existing: AddonItem | undefined;
  onConfirm: (item: AddonItem) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existing?.photoIds ?? (product.multiPhoto ? photos.slice(0, 30).map(p => p.id) : []))
  );
  const [selectedVariantId, setSelectedVariantId] = useState(existing?.variantId ?? "");

  const togglePhoto = (id: string) => {
    if (!product.multiPhoto) { setSelectedIds(new Set([id])); return; }
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const canConfirm = selectedIds.size > 0 && !!selectedVariantId;
  const selectedVariant = product.variants.find(v => v.id === selectedVariantId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Photo grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            {product.multiPhoto ? `Fotografie (vybráno ${selectedIds.size})` : "Vyberte fotografii"}
          </div>
          {product.multiPhoto && (
            <button onClick={() => setSelectedIds(new Set(photos.map(p => p.id)))} style={{ all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--fp-accent)", display: "flex", alignItems: "center", gap: 4 }}>
              <Sparkles size={12} /> Vybrat vše
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {photos.map(photo => {
            const isActive = selectedIds.has(photo.id);
            return (
              <PhotoThumb
                key={photo.id}
                src={`${BASE}${photo.thumbUrl}`}
                isActive={isActive}
                onClick={() => togglePhoto(photo.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Variants */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
          {product.multiPhoto ? "Formát" : "Velikost"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {product.variants.map(variant => {
            const isActive = selectedVariantId === variant.id;
            return (
              <button key={variant.id} onClick={() => setSelectedVariantId(variant.id)} style={{
                all: "unset", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10,
                border: isActive ? "2px solid var(--fp-accent)" : "1.5px solid var(--fp-line)",
                background: isActive ? "var(--fp-accent-soft)" : "var(--fp-bg)",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: isActive ? "var(--fp-accent)" : "var(--fp-ink)" }}>{variant.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: isActive ? "var(--fp-accent)" : "var(--fp-ink)" }}>{variant.price.toLocaleString("cs-CZ")} Kč</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm */}
      <button disabled={!canConfirm} onClick={() => {
        if (!canConfirm || !selectedVariant) return;
        onConfirm({ id: crypto.randomUUID(), productId: product.id, photoIds: [...selectedIds], variantId: selectedVariantId, qty: 1, price: selectedVariant.price });
      }} style={{
        all: "unset", cursor: canConfirm ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", boxSizing: "border-box", height: 52, borderRadius: 14,
        background: canConfirm ? "var(--fp-accent)" : "var(--fp-line)",
        color: canConfirm ? "#fff" : "var(--fp-ink-4)", fontSize: 15, fontWeight: 700,
        transition: "all 0.15s",
      }}>
        <Check size={18} strokeWidth={2.5} />
        Potvrdit
        {selectedVariant && <span style={{ opacity: 0.8, fontSize: 13 }}>· {selectedVariant.price.toLocaleString("cs-CZ")} Kč</span>}
      </button>
    </div>
  );
}

// ── Reusable square photo thumbnail — div instead of button to avoid all:unset issues ──
function PhotoThumb({ src, isActive, onClick }: { src: string; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderRadius: 8,
        overflow: "hidden",
        outline: isActive ? "3px solid var(--fp-accent)" : "2px solid transparent",
        outlineOffset: 1,
        transition: "outline 0.12s",
        // paddingBottom trick: reliable square across all browsers, no aspect-ratio quirks
        position: "relative",
        width: "100%",
        paddingBottom: "100%",
        background: "#ddd0bc",
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
        }}
      />
      {isActive && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(182,83,110,0.2)",
          display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
          padding: 4,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            background: "var(--fp-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
