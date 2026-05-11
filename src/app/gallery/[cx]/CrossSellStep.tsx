"use client";

import { useState } from "react";
import {
  useGalleryStore, ADDON_PRODUCTS, type AddonProductId, type AddonItem,
} from "@/lib/gallery-store";
import { ConfigSheet } from "@/components/ConfigSheet";
import {
  ArrowLeft, ArrowRight, Check, Edit2, FrameIcon, Printer, BookOpen,
  Trash2, Sparkles, Plus,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GalleryPhoto } from "@/lib/asp-parsers";

const BASE = "https://v1.fotoprome.cz";

const PRODUCT_ICONS: Record<AddonProductId, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  canvas:    FrameIcon,
  poster:    Printer,
  photobook: BookOpen,
};

const PRODUCT_ACCENTS: Record<AddonProductId, string> = {
  canvas:    "#8a6a48",
  poster:    "#4a6a4f",
  photobook: "#5a4878",
};

function addonsTotal(addons: AddonItem[]): number {
  return addons.reduce((s, a) => s + a.price, 0);
}

// Sheet state — either adding new or editing existing item
type SheetState =
  | { mode: "add"; productId: AddonProductId }
  | { mode: "edit"; item: AddonItem };

export function CrossSellStep({ cx }: { cx: string }) {
  const { photos, dreambox, addons, upsertAddon, removeAddon, setStep } = useGalleryStore();
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const dreamboxPhotos = [...dreambox]
    .map((id) => photos.find((p) => p.id === id))
    .filter(Boolean) as GalleryPhoto[];

  const sheetProductId = sheet ? (sheet.mode === "add" ? sheet.productId : sheet.item.productId) : undefined;
  const sheetProduct = sheetProductId ? ADDON_PRODUCTS.find((p) => p.id === sheetProductId) : undefined;
  const sheetExisting = sheet?.mode === "edit" ? sheet.item : undefined;

  const printsTotal = useGalleryStore((s) => {
    const PRICE: Record<string, number> = { retouch_only: 80, S: 120, M: 220, L: 480 };
    return [...s.dreambox].reduce((sum, pid) => {
      const cfg = s.configs[pid];
      if (!cfg) return sum;
      return sum + cfg.prints.reduce((ps, l) => ps + (PRICE[l.size] ?? 0) * (l.qty || 0), 0);
    }, 0);
  });

  const grandTotal = printsTotal + addonsTotal(addons);

  function handleConfirm(item: Omit<AddonItem, "id">) {
    const id = sheet?.mode === "edit" ? sheet.item.id : crypto.randomUUID();
    upsertAddon({ ...item, id });
    setSheet(null);
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>
          Krok 3 ze 4 — Doplňkové produkty
        </div>
        <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: isMobile ? 28 : 36, color: "var(--fp-ink)" }}>
          Přidat <em>k objednávce</em>
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--fp-ink-3)" }}>
          Nepovinné — přeskočte, pokud si přejete pouze fotografie.
        </p>
      </div>

      {/* Product sections */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
        gap: 16,
        marginBottom: 32,
        alignItems: "start",
      }}>
        {ADDON_PRODUCTS.map((product) => {
          const productAddons = addons.filter((a) => a.productId === product.id);
          const accent = PRODUCT_ACCENTS[product.id];
          const Icon = PRODUCT_ICONS[product.id];

          return (
            <div
              key={product.id}
              style={{
                borderRadius: 16,
                border: productAddons.length > 0 ? "1.5px solid var(--fp-accent)" : "1px solid var(--fp-line)",
                background: "var(--fp-surface)",
                overflow: "hidden",
                boxShadow: productAddons.length > 0 ? "0 4px 20px rgba(182,83,110,0.10)" : "var(--fp-shadow-sm)",
                transition: "all 0.2s ease",
              }}
            >
              {/* Hero mockup */}
              <div style={{ position: "relative", height: 148, overflow: "hidden" }}>
                {product.id === "canvas"    && <CanvasMockup />}
                {product.id === "poster"    && <PosterMockup />}
                {product.id === "photobook" && <PhotobookMockup />}

                {/* Overlay: tag + price */}
                {product.tag && (
                  <div style={{
                    position: "absolute", top: 12, left: 12,
                    padding: "4px 10px", borderRadius: 999,
                    background: accent, color: "#fff",
                    fontSize: 10.5, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Sparkles size={10} strokeWidth={2} /> {product.tag}
                  </div>
                )}
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  padding: "4px 10px", borderRadius: 999,
                  background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)",
                  fontSize: 11.5, fontWeight: 700, color: accent,
                }}>
                  od {product.priceFrom.toLocaleString("cs-CZ")} Kč
                </div>
                {productAddons.length > 0 && (
                  <div style={{
                    position: "absolute", bottom: 12, right: 12,
                    padding: "4px 10px", borderRadius: 999,
                    background: "var(--fp-accent)", color: "#fff",
                    fontSize: 11, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Check size={11} strokeWidth={3} />
                    {productAddons.length} {productAddons.length === 1 ? "ks" : "ks"}
                  </div>
                )}
              </div>

              {/* Card body */}
              <div style={{ padding: "16px 18px 18px" }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: productAddons.length > 0 ? "var(--fp-accent-soft)" : "var(--fp-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ color: productAddons.length > 0 ? "var(--fp-accent)" : "var(--fp-ink-3)" }}><Icon size={16} strokeWidth={1.6} /></div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-ink)" }}>{product.name}</div>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--fp-ink-3)", lineHeight: 1.55 }}>
                  {product.description}
                </p>

                {/* Added items list */}
                {productAddons.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {productAddons.map((addon, idx) => {
                      const variant = product.variants.find((v) => v.id === addon.variantId);
                      return (
                        <AddonItemRow
                          key={addon.id}
                          addon={addon}
                          variant={variant}
                          dreamboxPhotos={dreamboxPhotos}
                          index={idx}
                          onEdit={() => setSheet({ mode: "edit", item: addon })}
                          onRemove={() => removeAddon(addon.id)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Add / Add another button */}
                <button
                  onClick={() => setSheet({ mode: "add", productId: product.id })}
                  style={{
                    all: "unset", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 36, padding: "0 16px", borderRadius: 9,
                    border: productAddons.length > 0
                      ? "1.5px dashed var(--fp-accent)"
                      : "1.5px solid var(--fp-ink)",
                    background: "transparent",
                    fontSize: 13, fontWeight: 600,
                    color: productAddons.length > 0 ? "var(--fp-accent)" : "var(--fp-ink)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  {productAddons.length > 0 ? "Přidat další" : "Přidat"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
        paddingTop: 0,
        paddingLeft: isMobile ? 12 : 48,
        paddingRight: isMobile ? 12 : 48,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", marginBottom: 20,
          padding: isMobile ? "10px 10px 10px 16px" : "10px 10px 10px 24px",
          borderRadius: 14,
          background: "rgba(28,26,23,0.96)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          boxShadow: "0 -4px 32px rgba(28,26,23,0.2)",
        }}>
          <div style={{ color: "#fff" }}>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Celkem</div>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: isMobile ? 18 : 22 }}>
              {grandTotal.toLocaleString("cs-CZ")} Kč
              {addons.length > 0 && (
                <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8, fontFamily: "inherit" }}>
                  vč. {addons.length} {addons.length === 1 ? "doplněk" : "doplňků"}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{
              all: "unset", cursor: "pointer",
              height: 44, padding: "0 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.1)", color: "#fff",
              fontSize: 13, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 5,
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <ArrowLeft size={14} /> {!isMobile && "Zpět"}
            </button>
            <button onClick={() => setStep(4)} style={{
              all: "unset", cursor: "pointer",
              height: 44, padding: isMobile ? "0 16px" : "0 22px", borderRadius: 10,
              background: "#fff", color: "var(--fp-ink)",
              fontSize: isMobile ? 13 : 14, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              Pokračovat na rekapitulaci <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Config sheet */}
      {sheetProduct && (
        <ConfigSheet
          open={sheet !== null}
          onClose={() => setSheet(null)}
          title={sheetProduct.name}
        >
          {sheetProduct.multiPhoto ? (
            <MultiphotoConfig
              product={sheetProduct}
              dreamboxPhotos={dreamboxPhotos}
              existing={sheetExisting}
              onConfirm={handleConfirm}
              onClose={() => setSheet(null)}
            />
          ) : (
            <SinglePhotoConfig
              product={sheetProduct}
              dreamboxPhotos={dreamboxPhotos}
              existing={sheetExisting}
              onConfirm={handleConfirm}
              onClose={() => setSheet(null)}
            />
          )}
        </ConfigSheet>
      )}
    </div>
  );
}

// ── Single added item row ───────────────────────────────────────────────────

function AddonItemRow({
  addon, variant, dreamboxPhotos, index, onEdit, onRemove,
}: {
  addon: AddonItem;
  variant: typeof ADDON_PRODUCTS[0]["variants"][0] | undefined;
  dreamboxPhotos: GalleryPhoto[];
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 10,
      background: "var(--fp-bg)", border: "1px solid var(--fp-line)",
    }}>
      {/* Mini photo strip */}
      {addon.photoIds.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {addon.photoIds.slice(0, 3).map((pid) => {
            const p = dreamboxPhotos.find((ph) => ph.id === pid);
            if (!p) return null;
            return (
              <div key={pid} style={{ width: 32, height: 32, borderRadius: 5, overflow: "hidden", flexShrink: 0 }}>
                <img src={`${BASE}${p.fullUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            );
          })}
          {addon.photoIds.length > 3 && (
            <div style={{
              width: 32, height: 32, borderRadius: 5, flexShrink: 0,
              background: "var(--fp-line)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--fp-ink-3)",
            }}>
              +{addon.photoIds.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fp-ink)" }}>
          {variant?.label ?? "—"}
          {addon.qty > 1 && ` · ${addon.qty} ks`}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fp-ink-3)", marginTop: 1 }}>
          {addon.price.toLocaleString("cs-CZ")} Kč
        </div>
      </div>

      {/* Edit / Remove */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={onEdit}
          title="Upravit"
          style={{
            all: "unset", cursor: "pointer",
            width: 30, height: 30, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
            color: "var(--fp-ink-3)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--fp-accent)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--fp-ink-3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-line)"; }}
        >
          <Edit2 size={13} strokeWidth={2} />
        </button>
        <button
          onClick={onRemove}
          title="Odebrat"
          style={{
            all: "unset", cursor: "pointer",
            width: 30, height: 30, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
            color: "var(--fp-ink-3)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c0392b"; (e.currentTarget as HTMLElement).style.background = "rgba(192,57,43,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--fp-ink-3)"; (e.currentTarget as HTMLElement).style.background = "var(--fp-surface)"; }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

// ── Single-photo config (Canvas, Poster) ────────────────────────────────────

function SinglePhotoConfig({
  product, dreamboxPhotos, existing, onConfirm, onClose,
}: {
  product: typeof ADDON_PRODUCTS[0];
  dreamboxPhotos: GalleryPhoto[];
  existing: AddonItem | undefined;
  onConfirm: (item: Omit<AddonItem, "id">) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existing?.photoIds ?? [])
  );
  const [selectedVariantId, setSelectedVariantId] = useState(existing?.variantId ?? "");

  const toggle = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const canConfirm = selectedIds.size > 0 && !!selectedVariantId;
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const totalPrice = (selectedVariant?.price ?? 0) * selectedIds.size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--fp-ink-3)", lineHeight: 1.55 }}>
        Vyberte jednu nebo více fotografií — každá bude samostatný {product.name.toLowerCase()}.
      </p>

      {/* Photo grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Fotografie
            {selectedIds.size > 0 && (
              <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 999, background: "var(--fp-accent-soft)", color: "var(--fp-accent)", fontSize: 10, fontWeight: 600 }}>
                {selectedIds.size} {selectedIds.size === 1 ? "vybrána" : "vybrány"}
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "var(--fp-ink-4)", fontWeight: 500 }}>
              Zrušit výběr
            </button>
          )}
        </div>

        {dreamboxPhotos.length === 0 ? (
          <p style={{ color: "var(--fp-ink-3)", fontSize: 13 }}>Nejsou vybrané žádné fotky v Dreamboxu.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {dreamboxPhotos.map((photo) => {
              const isActive = selectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  onClick={() => toggle(photo.id)}
                  style={{
                    cursor: "pointer", position: "relative",
                    width: "100%", paddingBottom: "100%",
                    borderRadius: 8, overflow: "hidden", background: "#ddd0bc",
                    outline: isActive ? "3px solid var(--fp-accent)" : "2px solid transparent",
                    outlineOffset: 1, transition: "outline 0.12s",
                  }}
                >
                  <img src={`${BASE}${photo.fullUrl}`} alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  {isActive && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(182,83,110,0.18)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 4 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--fp-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={10} strokeWidth={3} style={{ color: "#fff" }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Variant selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
          Velikost
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {product.variants.map((variant) => {
            const isActive = selectedVariantId === variant.id;
            return (
              <div key={variant.id} onClick={() => setSelectedVariantId(variant.id)} style={{
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12,
                border: isActive ? "2px solid var(--fp-accent)" : "1.5px solid var(--fp-line)",
                background: isActive ? "var(--fp-accent-soft)" : "var(--fp-bg)",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: isActive ? "var(--fp-accent)" : "var(--fp-ink)" }}>
                  {variant.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13.5, color: "var(--fp-ink-3)" }}>
                    {variant.price.toLocaleString("cs-CZ")} Kč / ks
                  </span>
                  {isActive && selectedIds.size > 1 && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-accent)" }}>
                      = {(variant.price * selectedIds.size).toLocaleString("cs-CZ")} Kč
                    </span>
                  )}
                  {isActive && (
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--fp-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={10} strokeWidth={3} style={{ color: "#fff" }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm */}
      <div
        onClick={() => {
          if (!canConfirm || !selectedVariant) return;
          onConfirm({
            productId: product.id as AddonProductId,
            photoIds: [...selectedIds],
            variantId: selectedVariantId,
            qty: selectedIds.size,
            price: totalPrice,
          });
        }}
        style={{
          cursor: canConfirm ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          height: 52, borderRadius: 14,
          background: canConfirm ? "var(--fp-accent)" : "var(--fp-line)",
          color: canConfirm ? "#fff" : "var(--fp-ink-4)",
          fontSize: 15, fontWeight: 700,
          transition: "all 0.15s",
          userSelect: "none",
        }}
      >
        <Check size={18} strokeWidth={2.5} />
        {existing ? "Uložit změny" : "Přidat k objednávce"}
        {canConfirm && selectedVariant && (
          <span style={{ opacity: 0.8, fontSize: 13 }}>
            · {selectedIds.size} ks · {totalPrice.toLocaleString("cs-CZ")} Kč
          </span>
        )}
      </div>
    </div>
  );
}

// ── Multi-photo config (Photobook) ──────────────────────────────────────────

function MultiphotoConfig({
  product, dreamboxPhotos, existing, onConfirm, onClose,
}: {
  product: typeof ADDON_PRODUCTS[0];
  dreamboxPhotos: GalleryPhoto[];
  existing: AddonItem | undefined;
  onConfirm: (item: Omit<AddonItem, "id">) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existing?.photoIds ?? [...dreamboxPhotos.map((p) => p.id)])
  );
  const [selectedVariantId, setSelectedVariantId] = useState(existing?.variantId ?? "");

  const togglePhoto = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(dreamboxPhotos.map((p) => p.id)));
  const canConfirm = selectedIds.size > 0 && !!selectedVariantId;
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--fp-bg)", border: "1px solid var(--fp-line)", fontSize: 13, color: "var(--fp-ink-2)", lineHeight: 1.55 }}>
        Vyberte fotografie pro vaši knížku. <strong>Ideálně 20–40 fotek</strong> pro optimální výsledek.
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Fotografie z Dreamboxu
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "var(--fp-accent-soft)", color: "var(--fp-accent)" }}>
              Vybráno {selectedIds.size}
            </span>
          </div>
          <button onClick={selectAll} style={{
            all: "unset", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "var(--fp-accent)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Sparkles size={12} strokeWidth={2} /> Vybrat celý Dreambox
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {dreamboxPhotos.map((photo) => {
            const isActive = selectedIds.has(photo.id);
            return (
              <div
                key={photo.id}
                onClick={() => togglePhoto(photo.id)}
                style={{
                  cursor: "pointer", position: "relative",
                  width: "100%", paddingBottom: "100%",
                  borderRadius: 8, overflow: "hidden", background: "#ddd0bc",
                  outline: isActive ? "3px solid var(--fp-accent)" : "2px solid transparent",
                  outlineOffset: 1, transition: "outline 0.12s",
                }}
              >
                <img
                  src={`${BASE}${photo.fullUrl}`} alt={`${photo.num}`}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                {isActive && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(182,83,110,0.18)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--fp-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={10} strokeWidth={3} style={{ color: "#fff" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
          Formát fotoknížky
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {product.variants.map((variant) => {
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

      <button
        disabled={!canConfirm}
        onClick={() => {
          if (!canConfirm || !selectedVariant) return;
          onConfirm({
            productId: product.id as AddonProductId,
            photoIds: [...selectedIds],
            variantId: selectedVariantId,
            qty: 1,
            price: selectedVariant.price,
          });
        }}
        style={{
          all: "unset", cursor: canConfirm ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", boxSizing: "border-box",
          height: 52, borderRadius: 14,
          background: canConfirm ? "var(--fp-accent)" : "var(--fp-line)",
          color: canConfirm ? "#fff" : "var(--fp-ink-4)",
          fontSize: 15, fontWeight: 700,
          transition: "all 0.15s",
        }}
      >
        <BookOpen size={18} strokeWidth={2} />
        {existing ? "Uložit změny" : "Přidat fotoknížku"}
        {selectedIds.size > 0 && <span style={{ opacity: 0.8, fontSize: 13 }}>· {selectedIds.size} fotek</span>}
      </button>
    </div>
  );
}

// ── CSS product mockups ─────────────────────────────────────────────────────

function CanvasMockup() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(160deg, #e8ddd0 0%, #d8cfc4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.25) 0%, transparent 70%)" }} />
      <div style={{ position: "relative", width: 108, height: 80, boxShadow: "6px 8px 24px rgba(80,55,30,0.28), 0 2px 6px rgba(0,0,0,0.12)" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #c4a278 0%, #a07850 40%, #b8926a 60%, #c4a278 100%)", borderRadius: 2 }} />
        <div style={{ position: "absolute", inset: 8, background: "linear-gradient(140deg, #e2c9a8 0%, #c8a882 50%, #b89068 100%)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 8px)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, transparent 60%)" }} />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.5)", borderRadius: "2px 2px 0 0" }} />
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
      <div style={{
        position: "absolute",
        width: 78, height: 108,
        background: "#f8f8f6",
        boxShadow: "2px 4px 12px rgba(0,0,0,0.12)",
        transform: "rotate(5deg) translate(36px, 2px)",
        borderRadius: 1, zIndex: 0,
      }} />
      <div style={{ position: "relative", width: 78, height: 108, background: "#fff", boxShadow: "4px 6px 20px rgba(40,60,40,0.22)", borderRadius: 1, zIndex: 1 }}>
        <div style={{ position: "absolute", top: 6, left: 6, right: 6, height: 70, background: "linear-gradient(140deg, #c8d8c0 0%, #a8c0a0 50%, #90ac88 100%)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 7px)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 55%)" }} />
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 8, right: 8 }}>
          <div style={{ height: 4, background: "#d4d4d0", borderRadius: 2, marginBottom: 4 }} />
          <div style={{ height: 3, background: "#e0e0dc", borderRadius: 2, width: "60%" }} />
        </div>
      </div>
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
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{
          position: "absolute", top: 2, left: 14, right: -2, bottom: -2,
          background: "linear-gradient(90deg, #e8e4e0 0%, #f0ece8 40%, #e8e4e0 100%)",
          borderRadius: "0 2px 2px 0", boxShadow: "2px 2px 8px rgba(0,0,0,0.12)",
        }}>
          {[10, 18, 26, 34, 42, 50, 58, 66, 74, 82].map(t => (
            <div key={t} style={{ position: "absolute", top: t, left: 2, right: 2, height: 0.5, background: "rgba(0,0,0,0.06)" }} />
          ))}
        </div>
        <div style={{
          position: "relative", width: 90, height: 96,
          background: "linear-gradient(135deg, #7060a8 0%, #584888 40%, #6858a0 100%)",
          borderRadius: "3px 6px 6px 3px",
          boxShadow: "4px 6px 20px rgba(60,40,100,0.3), -1px 0 0 rgba(0,0,0,0.15)",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 55%)", borderRadius: "3px 6px 6px 3px" }} />
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 8, background: "rgba(0,0,0,0.15)", borderRadius: "3px 0 0 3px" }} />
          <div style={{ position: "absolute", top: 14, left: 16, right: 12, height: 46, background: "linear-gradient(140deg, #c4b0d8 0%, #a898c0 50%, #9080b0 100%)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 7px)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, transparent 55%)" }} />
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 16, right: 12, height: 3, background: "rgba(255,255,255,0.35)", borderRadius: 2 }} />
          <div style={{ position: "absolute", bottom: 9, left: 16, width: "40%", height: 2, background: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}
