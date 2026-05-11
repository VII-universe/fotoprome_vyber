"use client";

import { useState, useEffect, useCallback } from "react";
import { useGalleryStore } from "@/lib/gallery-store";
import { toast } from "sonner";
import {
  Heart, Sparkles, ArrowRight, ZoomIn, LayoutGrid, Columns2, Grid3x3,
  X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GalleryPhoto } from "@/lib/asp-parsers";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BASE = "https://v1.fotoprome.cz";

// ── Types ──────────────────────────────────────────────────────────────────

type FilterMode = "all" | "suggested" | "dreambox";
type ViewMode   = "masonry" | "large" | "square";

// ── View options ───────────────────────────────────────────────────────────

const VIEW_OPTS: { id: ViewMode; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; title: string }[] = [
  { id: "masonry", Icon: LayoutGrid, title: "Přirozené (masonry)" },
  { id: "large",   Icon: Columns2,   title: "Velké náhledy" },
  { id: "square",  Icon: Grid3x3,    title: "Čtvercová mřížka" },
];

const FILTER_PILLS: { id: FilterMode; label: string }[] = [
  { id: "all",       label: "Všechny" },
  { id: "suggested", label: "Doporučené" },
  { id: "dreambox",  label: "Dreambox" },
];

// JS masonry: rozdělí fotky do N sloupců (round-robin)
// Žádné CSS column balancing → žádné ořezy, funguje s libovolným počtem fotek
function distributeColumns<T>(items: T[], numCols: number): T[][] {
  const cols = Array.from({ length: numCols }, (): T[] => []);
  items.forEach((item, i) => cols[i % numCols].push(item));
  return cols;
}

function MasonryGrid({
  photos, numCols, gap, children,
}: {
  photos: GalleryPhoto[];
  numCols: number;
  gap: number;
  children: (photo: GalleryPhoto) => React.ReactNode;
}) {
  const cols = distributeColumns(photos, numCols);
  return (
    <div style={{ display: "flex", gap, alignItems: "flex-start" }}>
      {cols.map((col, ci) => (
        <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
          {col.map((photo) => children(photo))}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DreamboxStep({ cx }: { cx: string }) {
  const { photos, dreambox, toggleHeart, filterMode, setFilterMode, setStep } = useGalleryStore();

  const [savingId,      setSavingId]      = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);
  const [viewMode,      setViewMode]      = useState<ViewMode>("masonry");
  const [dreamboxOrder, setDreamboxOrder] = useState<string[]>(() => [...dreambox]);
  const isMobile = useIsMobile();

  useEffect(() => {
    setDreamboxOrder((prev) => {
      const existing = new Set(prev);
      const added    = [...dreambox].filter((id) => !existing.has(id));
      const kept     = prev.filter((id) => dreambox.has(id));
      return [...kept, ...added];
    });
  }, [dreambox]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDreamboxOrder((items) => {
        const from = items.indexOf(String(active.id));
        const to   = items.indexOf(String(over.id));
        return arrayMove(items, from, to);
      });
    }
  }, []);

  async function handleHeart(photo: GalleryPhoto, e: React.MouseEvent) {
    e.stopPropagation();
    const wasIn = dreambox.has(photo.id);
    setSavingId(photo.id);
    try {
      await fetch("/api/dreambox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          act: wasIn ? "drop" : "update",
          pid: photo.id, did: photo.dreamboxItemId ?? "0",
          zone: photo.zone, cx,
          colorA4: wasIn ? 0 : 1,
        }),
      });
      toggleHeart(photo.id, photo.zone, photo.dreamboxItemId);
    } catch {
      toast.error("Nepodařilo se uložit výběr");
    } finally {
      setSavingId(null);
    }
  }

  // Build photo list for current filter
  const filtered: GalleryPhoto[] =
    filterMode === "suggested" ? photos.filter((p) => p.isSuggested) :
    filterMode === "dreambox"  ? (dreamboxOrder.length ? dreamboxOrder : [...dreambox])
                                    .map((id) => photos.find((p) => p.id === id))
                                    .filter(Boolean) as GalleryPhoto[] :
    photos;

  // Lightbox nav
  const lbIdx  = lightboxPhoto ? filtered.findIndex((p) => p.id === lightboxPhoto.id) : -1;
  const lbPrev = lbIdx > 0                    ? filtered[lbIdx - 1] : null;
  const lbNext = lbIdx < filtered.length - 1  ? filtered[lbIdx + 1] : null;

  const isDreamboxView = filterMode === "dreambox";

  return (
    <div style={{ paddingBottom: 120 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>
              Krok 1 ze 3 — Výběr fotek
            </div>
            <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: isMobile ? 28 : 36, letterSpacing: -0.5, color: "var(--fp-ink)" }}>
              Galerie
            </h1>
            <div style={{ fontSize: 13, color: "var(--fp-ink-3)", marginTop: 6 }}>
              {photos.length} fotek · Označte srdíčkem, které se vám líbí
            </div>
          </div>

          {/* View toggle — always visible top-right */}
          <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, border: "1px solid var(--fp-line)", background: "var(--fp-surface)", flexShrink: 0 }}>
            {VIEW_OPTS.map(({ id, Icon, title }) => (
              <button key={id} onClick={() => setViewMode(id)} title={title} style={{
                all: "unset", cursor: "pointer",
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: viewMode === id ? "var(--fp-ink)" : "transparent",
                color:      viewMode === id ? "#fff"         : "var(--fp-ink-3)",
                transition: "all 0.15s ease",
              }}>
                <Icon size={15} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </div>

        {/* Filter pills — horizontal scroll on mobile */}
        <div style={{
          marginTop: 14,
          display: "flex", gap: 6,
          overflowX: isMobile ? "auto" : "visible",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          paddingBottom: isMobile ? 4 : 0,
          flexWrap: isMobile ? "nowrap" : "wrap",
        } as React.CSSProperties}>
          {FILTER_PILLS.map((f) => (
            <button key={f.id} onClick={() => setFilterMode(f.id)} style={{
              all: "unset", cursor: "pointer",
              padding: "8px 14px", borderRadius: 999,
              fontSize: 12.5, fontWeight: 500,
              flexShrink: 0,
              background: filterMode === f.id ? "var(--fp-ink)"  : "transparent",
              color:      filterMode === f.id ? "#fff"           : "var(--fp-ink-2)",
              border:     filterMode === f.id ? "1px solid var(--fp-ink)" : "1px solid var(--fp-line)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {f.id === "suggested" && <Sparkles size={12} strokeWidth={1.8} />}
              {f.label}
              {f.id === "dreambox" && dreambox.size > 0 && (
                <span style={{
                  padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: filterMode === "dreambox" ? "rgba(255,255,255,0.25)" : "var(--fp-accent-soft)",
                  color:      filterMode === "dreambox" ? "#fff"                   : "var(--fp-accent)",
                }}>{dreambox.size}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Photo grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--fp-ink-3)" }}>
          {filterMode === "dreambox"
            ? "Zatím jste nevybrali žádné fotky. Klikněte na ♡ u fotek, které se vám líbí."
            : "Žádné fotky v tomto filtru."}

        </div>
      ) : viewMode === "square" ? (
        // ── Čtvercová mřížka ──
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 4 }}>
          {filtered.map((photo) => (
            <SquareTile key={photo.id} photo={photo}
              selected={dreambox.has(photo.id)} saving={savingId === photo.id}
              onHeart={handleHeart} onZoom={setLightboxPhoto} />
          ))}
        </div>

      ) : viewMode === "large" ? (
        // ── Velké náhledy: JS masonry 2 sloupce (1 na mobilu) ──
        <MasonryGrid photos={filtered} numCols={isMobile ? 1 : 2} gap={isMobile ? 12 : 16}>
          {(photo) => (
            <NaturalTile key={photo.id} photo={photo}
              selected={dreambox.has(photo.id)} saving={savingId === photo.id}
              onHeart={handleHeart} onZoom={setLightboxPhoto} />
          )}
        </MasonryGrid>

      ) : isDreamboxView && dreambox.size > 0 ? (
        // ── Dreambox: DnD na desktopu, plain na mobilu — JS masonry ──
        isMobile ? (
          <MasonryGrid photos={dreamboxOrder.map(id => photos.find(ph => ph.id === id)).filter(Boolean) as GalleryPhoto[]} numCols={2} gap={8}>
            {(photo) => (
              <NaturalTile key={photo.id} photo={photo} selected saving={savingId === photo.id}
                onHeart={handleHeart} onZoom={setLightboxPhoto} />
            )}
          </MasonryGrid>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dreamboxOrder} strategy={rectSortingStrategy}>
              <MasonryGrid photos={dreamboxOrder.map(id => photos.find(ph => ph.id === id)).filter(Boolean) as GalleryPhoto[]} numCols={4} gap={12}>
                {(photo) => (
                  <SortableNaturalTile key={photo.id} photo={photo} selected saving={savingId === photo.id}
                    onHeart={handleHeart} onZoom={setLightboxPhoto} />
                )}
              </MasonryGrid>
            </SortableContext>
          </DndContext>
        )

      ) : (
        // ── Masonry výchozí: JS masonry, žádné CSS balancing, žádné ořezy ──
        <MasonryGrid photos={filtered} numCols={isMobile ? 2 : 4} gap={isMobile ? 8 : 12}>
          {(photo) => (
            <NaturalTile key={photo.id} photo={photo}
              selected={dreambox.has(photo.id)} saving={savingId === photo.id}
              onHeart={handleHeart} onZoom={setLightboxPhoto} />
          )}
        </MasonryGrid>
      )}

      {/* ── Dark floating Dreambox bar ── */}
      {dreambox.size > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          paddingTop: 0,
          paddingLeft: isMobile ? 12 : 48,
          paddingRight: isMobile ? 12 : 48,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          zIndex: 30,
        }}>
          {isMobile ? (
            /* ── Mobile bar: compact 2-row layout ── */
            <div style={{
              maxWidth: 600, margin: "0 auto", marginBottom: 12,
              borderRadius: 16, background: "rgba(28,26,23,0.97)", backdropFilter: "blur(20px)",
              boxShadow: "0 -4px 24px rgba(28,26,23,0.25)",
              overflow: "hidden",
            }}>
              {/* Top row: heart icon + count + mini thumbs */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: "var(--fp-accent)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Heart size={14} strokeWidth={2} fill="#fff" />
                </div>
                <div style={{ color: "#fff", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Vybráno {dreambox.size}</span>
                  <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 6 }}>/ {photos.length}</span>
                </div>
                {/* Max 3 mini thumbs */}
                <div style={{ display: "flex" }}>
                  {[...dreambox].slice(0, 3).map((id, i) => {
                    const p = photos.find((ph) => ph.id === id);
                    return p ? (
                      <div key={id} style={{
                        width: 28, height: 28, borderRadius: 5, overflow: "hidden",
                        marginLeft: i === 0 ? 0 : -6, border: "1.5px solid #1c1a17",
                      }}>
                        <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ) : null;
                  })}
                  {dreambox.size > 3 && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 5, marginLeft: -6,
                      background: "rgba(255,255,255,0.15)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600, border: "1.5px solid #1c1a17",
                    }}>+{dreambox.size - 3}</div>
                  )}
                </div>
              </div>
              {/* Bottom row: full-width CTA button */}
              <div style={{ padding: "0 10px 10px" }}>
                <button onClick={() => setStep(2)} style={{
                  all: "unset", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", boxSizing: "border-box",
                  height: 48, borderRadius: 12,
                  background: "#fff", color: "var(--fp-ink)",
                  fontSize: 15, fontWeight: 700,
                }}>
                  Konfigurovat výběr <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : (
            /* ── Desktop bar: original wide layout ── */
            <div style={{
              maxWidth: 1200, margin: "0 auto", marginBottom: 24, padding: 8,
              borderRadius: 14, background: "rgba(28,26,23,0.95)", backdropFilter: "blur(20px)",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 18px 40px rgba(28,26,23,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 8px 0 14px", flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--fp-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Heart size={16} strokeWidth={2} fill="#fff" />
                </div>
                <div style={{ color: "#fff" }}>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Dreambox</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {dreambox.size} fotek vybráno
                    <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: 8 }}>· z {photos.length}</span>
                  </div>
                </div>
                <div style={{ display: "flex", marginLeft: 18 }}>
                  {[...dreambox].slice(0, 5).map((id, i) => {
                    const p = photos.find((ph) => ph.id === id);
                    return p ? (
                      <div key={id} style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", marginLeft: i === 0 ? 0 : -8, border: "2px solid #1c1a17", background: "#3a3530" }}>
                        <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ) : null;
                  })}
                  {dreambox.size > 5 && (
                    <div style={{ width: 32, height: 32, borderRadius: 6, marginLeft: -8, background: "rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, border: "2px solid #1c1a17" }}>
                      +{dreambox.size - 5}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setStep(2)} style={{
                all: "unset", cursor: "pointer",
                height: 44, padding: "0 20px", borderRadius: 10,
                background: "#fff", color: "var(--fp-ink)",
                fontSize: 14, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                Pokračovat ke konfiguraci <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxPhoto && (
        <div onClick={() => setLightboxPhoto(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(28,26,23,0.93)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setLightboxPhoto(null)} style={{ all: "unset", cursor: "pointer", position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
          <button disabled={!lbPrev} onClick={(e) => { e.stopPropagation(); lbPrev && setLightboxPhoto(lbPrev); }} style={{ all: "unset", cursor: lbPrev ? "pointer" : "default", position: "absolute", left: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", opacity: lbPrev ? 1 : 0.25 }}>
            <ChevronLeft size={22} />
          </button>
          <img src={`${BASE}${lightboxPhoto.fullUrl}`} alt={`Foto ${lightboxPhoto.num}`} onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", maxWidth: "90vw", borderRadius: 8, objectFit: "contain" }} />
          <button disabled={!lbNext} onClick={(e) => { e.stopPropagation(); lbNext && setLightboxPhoto(lbNext); }} style={{ all: "unset", cursor: lbNext ? "pointer" : "default", position: "absolute", right: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", opacity: lbNext ? 1 : 0.25 }}>
            <ChevronRight size={22} />
          </button>
          <div style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
            #{lightboxPhoto.num} &nbsp;·&nbsp; {lbIdx + 1} / {filtered.length}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Natural-ratio tile (large + dreambox DnD grid) ────────────────────────

interface TileBaseProps {
  photo: GalleryPhoto;
  selected: boolean;
  saving: boolean;
  onHeart: (photo: GalleryPhoto, e: React.MouseEvent) => void;
  onZoom: (photo: GalleryPhoto) => void;
}

function NaturalTile({ photo, selected, saving, onHeart, onZoom }: TileBaseProps) {
  const [hovered, setHovered] = useState(false);
  const isActive = hovered || selected;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onZoom(photo)}
      style={{
        position: "relative", borderRadius: "var(--fp-r-photo)", overflow: "hidden",
        cursor: "zoom-in", background: "#ddd0bc",
        outline: selected ? "2px solid var(--fp-accent)" : "2px solid transparent",
        outlineOffset: 2,
        transform: hovered ? "scale(1.012)" : "scale(1)",
        transition: "transform 0.2s ease, outline 0.15s ease",
      }}
    >
      <img src={`${BASE}${photo.fullUrl}`} alt={`Foto ${photo.num}`} loading="lazy"
        style={{ display: "block", width: "100%", height: "auto" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isActive ? "linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.22) 100%)" : "transparent", transition: "background 0.2s" }} />
      {photo.isSuggested && (
        <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "var(--fp-ink)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <Sparkles size={9} strokeWidth={2} />Doporučené
        </div>
      )}
      <button onClick={(e) => onHeart(photo, e)} disabled={saving} style={{
        all: "unset", cursor: "pointer", position: "absolute", top: 8, right: 8,
        width: 36, height: 36, borderRadius: "50%",
        background: selected ? "var(--fp-accent)" : "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)", color: selected ? "#fff" : "var(--fp-ink)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)", opacity: isActive ? 1 : 0.8,
        transition: "all 0.18s ease",
      }}>
        <Heart size={16} strokeWidth={2} fill={selected ? "#fff" : "none"} />
      </button>
    </div>
  );
}

// ── Square tile ────────────────────────────────────────────────────────────

function SquareTile({ photo, selected, saving, onHeart, onZoom }: TileBaseProps) {
  const [hovered, setHovered] = useState(false);
  const isActive = hovered || selected;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onZoom(photo)}
      style={{
        position: "relative", aspectRatio: "1/1", overflow: "hidden",
        borderRadius: "var(--fp-r-photo)", cursor: "zoom-in", background: "#ddd0bc",
        outline: selected ? "2px solid var(--fp-accent)" : "2px solid transparent",
        outlineOffset: 2,
        transform: hovered ? "scale(1.012)" : "scale(1)",
        transition: "transform 0.2s ease, outline 0.15s ease",
      }}
    >
      <img src={`${BASE}${photo.fullUrl}`} alt={`Foto ${photo.num}`} loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isActive ? "linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.22) 100%)" : "transparent", transition: "background 0.2s" }} />
      {photo.isSuggested && (
        <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "var(--fp-ink)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <Sparkles size={9} strokeWidth={2} />Doporučené
        </div>
      )}
      <button onClick={(e) => onHeart(photo, e)} disabled={saving} style={{
        all: "unset", cursor: "pointer", position: "absolute", top: 8, right: 8,
        width: 36, height: 36, borderRadius: "50%",
        background: selected ? "var(--fp-accent)" : "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)", color: selected ? "#fff" : "var(--fp-ink)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)", opacity: isActive ? 1 : 0.8,
        transition: "all 0.18s ease",
      }}>
        <Heart size={16} strokeWidth={2} fill={selected ? "#fff" : "none"} />
      </button>
    </div>
  );
}

// ── Sortable wrapper for DnD ───────────────────────────────────────────────

function SortableNaturalTile({ photo, ...props }: TileBaseProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }} {...attributes} {...listeners}>
      <NaturalTile photo={photo} {...props} />
    </div>
  );
}
