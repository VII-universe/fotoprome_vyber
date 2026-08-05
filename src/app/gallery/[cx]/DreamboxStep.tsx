"use client";

import { useState, useEffect, useCallback } from "react";
import { useGalleryStore, PACKAGES } from "@/lib/gallery-store";
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

// JS masonry: round-robin columns (kept for DnD dreambox view)
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

// Smart grid: portrait a landscape mají podobnou vizuální váhu
// Portrait: 1 col × 3 rows  → přirozený poměr 2:3
// Landscape: 2 cols × 2 rows → přirozený poměr ~3:2
// grid-auto-flow: dense vyplní mezery automaticky
function SmartGrid({
  photos, numCols, gap, rowH, landscapeIds, children,
}: {
  photos: GalleryPhoto[];
  numCols: number;
  gap: number;
  rowH: number;
  landscapeIds: Set<string>;
  children: (photo: GalleryPhoto) => React.ReactNode;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${numCols}, 1fr)`,
      gridAutoRows: `${rowH}px`,
      gridAutoFlow: "row dense",
      gap,
    }}>
      {photos.map((photo) => {
        const isLandscape = landscapeIds.has(photo.id);
        return (
          <div key={photo.id} style={{
            gridColumn: isLandscape ? "span 2" : "span 1",
            gridRow: isLandscape ? "span 2" : "span 3",
            overflow: "hidden",
            position: "relative",
          }}>
            {children(photo)}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DreamboxStep({ cx }: { cx: string }) {
  const { photos, dreambox, toggleHeart, filterMode, setFilterMode, setStep, selectedPackageId, setPackage, photoCredits, usedCredits, setPhotoCredits, setUsedCredits } = useGalleryStore();

  const [savingId,      setSavingId]      = useState<string | null>(null);
  const [applyingCredits, setApplyingCredits] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);
  const [viewMode,      setViewMode]      = useState<ViewMode>("masonry");
  const [dreamboxOrder, setDreamboxOrder] = useState<string[]>(() => [...dreambox]);
  const [landscapeIds,  setLandscapeIds]  = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => { if (typeof d.balance === "number") setPhotoCredits(d.balance); })
      .catch(() => {});
  }, [setPhotoCredits]);

  const handleOrientationDetect = useCallback((id: string) => {
    setLandscapeIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

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
          <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 0, border: "1px solid var(--fp-line)", background: "var(--fp-surface)", flexShrink: 0 }}>
            {VIEW_OPTS.map(({ id, Icon, title }) => (
              <button key={id} onClick={() => setViewMode(id)} title={title} style={{
                all: "unset", cursor: "pointer",
                width: 32, height: 32, borderRadius: 0,
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
              padding: "8px 14px", borderRadius: 0,
              fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em",
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
                  padding: "1px 7px", fontSize: 11, fontWeight: 600,
                  background: filterMode === "dreambox" ? "rgba(255,255,255,0.25)" : "var(--fp-accent-soft)",
                  color:      filterMode === "dreambox" ? "#fff"                   : "var(--fp-accent)",
                }}>{dreambox.size}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Photo credits banner ── */}
      {photoCredits > 0 && usedCredits === 0 && (
        <div style={{
          margin: "16px 0 0",
          padding: "14px 18px",
          background: "linear-gradient(135deg, #2a1f0e 0%, #3d2d12 100%)",
          border: "1px solid #6b4c1a",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🎟️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0d080", marginBottom: 3 }}>
              Máte {photoCredits} nevyčerpaných {photoCredits === 1 ? "fotku" : photoCredits < 5 ? "fotky" : "fotek"} z předchozí objednávky
            </div>
            <div style={{ fontSize: 12, color: "rgba(240,208,128,0.65)", lineHeight: 1.5 }}>
              Tyto fotky jsou zahrnuty v ceně — použijte je v této objednávce.
            </div>
          </div>
          <button
            disabled={applyingCredits}
            onClick={async () => {
              setApplyingCredits(true);
              try {
                const res = await fetch("/api/credits", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "use", amount: photoCredits }),
                });
                const d = await res.json();
                if (d.ok) {
                  setUsedCredits(d.used);
                  setPhotoCredits(d.balance);
                }
              } catch { /* ignore */ }
              finally { setApplyingCredits(false); }
            }}
            style={{
              all: "unset", cursor: applyingCredits ? "not-allowed" : "pointer",
              padding: "9px 20px", flexShrink: 0,
              background: "#f0d080", color: "#2a1f0e",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
              opacity: applyingCredits ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            Použít kredity ({photoCredits} fotek)
          </button>
        </div>
      )}

      {/* Credits applied confirmation */}
      {usedCredits > 0 && (
        <div style={{
          margin: "16px 0 0",
          padding: "10px 18px",
          background: "rgba(45,90,39,0.15)",
          border: "1px solid #2d5a27",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 18 }}>✅</div>
          <div style={{ fontSize: 13, color: "#2d5a27", fontWeight: 600 }}>
            {usedCredits} {usedCredits === 1 ? "fotka" : usedCredits < 5 ? "fotky" : "fotek"} z předchozí objednávky přidány do tohoto výběru
          </div>
          <button
            onClick={async () => {
              // Return the credits
              try {
                const res = await fetch("/api/credits", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "earn", cx: "return", packageName: "vrácení", unused: usedCredits }),
                });
                const d = await res.json();
                if (d.ok) { setPhotoCredits(d.balance); setUsedCredits(0); }
              } catch { /* ignore */ }
            }}
            style={{
              all: "unset", cursor: "pointer", marginLeft: "auto",
              fontSize: 11, color: "#2d5a27", textDecoration: "underline",
            }}
          >
            Zrušit
          </button>
        </div>
      )}

      {/* ── Package picker ── */}
      <div style={{ margin: "20px 0", padding: "18px 20px", background: "var(--fp-surface)", border: "1px solid var(--fp-line)" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14 }}>
          Vyberte balíček
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PACKAGES.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            const effectiveIncluded = pkg.includedPhotos + usedCredits;
            const remaining = effectiveIncluded - dreambox.size;
            return (
              <button
                key={pkg.id}
                onClick={() => setPackage(isSelected ? null : pkg.id)}
                style={{
                  all: "unset", cursor: "pointer", flex: "1 1 160px",
                  padding: "14px 16px", position: "relative",
                  border: isSelected ? "2px solid var(--fp-ink)" : "1.5px solid var(--fp-line)",
                  background: isSelected ? "var(--fp-ink)" : "var(--fp-bg)",
                  transition: "all 0.18s ease",
                  textAlign: "left",
                }}
              >
                {pkg.tag && (
                  <div style={{
                    position: "absolute", top: -1, right: 12,
                    background: isSelected ? "#fff" : "var(--fp-ink)",
                    color: isSelected ? "var(--fp-ink)" : "#fff",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "2px 7px",
                  }}>{pkg.tag}</div>
                )}
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: 20, color: isSelected ? "#fff" : "var(--fp-ink)",
                  }}>{pkg.name}</span>
                  <span style={{ fontSize: 11, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--fp-ink-4)" }}>·</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#fff" : "var(--fp-ink)" }}>
                    {usedCredits > 0 ? `${pkg.includedPhotos}+${usedCredits}` : pkg.includedPhotos} fotek
                  </span>
                </div>
                <div style={{ fontSize: 11, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--fp-ink-3)", marginBottom: 10 }}>
                  {pkg.subtitle}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: 22, color: isSelected ? "#fff" : "var(--fp-ink)",
                  }}>{pkg.basePrice.toLocaleString("cs-CZ")} Kč</span>
                  {isSelected && dreambox.size > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: remaining >= 0 ? "rgba(255,255,255,0.7)" : "#f4a261" }}>
                      {remaining >= 0 ? `zbývá ${remaining}` : `+${-remaining} navíc`}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div style={{
                    marginTop: 8, fontSize: 10.5, color: "rgba(255,255,255,0.55)",
                    borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8,
                  }}>
                    Každá fotka navíc +{pkg.extraPhotoPrice} Kč
                  </div>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setPackage(null)}
            style={{
              all: "unset", cursor: "pointer", flex: "1 1 120px",
              padding: "14px 16px",
              border: !selectedPackageId ? "2px solid var(--fp-ink)" : "1.5px solid var(--fp-line)",
              background: !selectedPackageId ? "var(--fp-ink)" : "transparent",
              textAlign: "left", transition: "all 0.18s ease",
            }}
          >
            <div style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 18, color: !selectedPackageId ? "#fff" : "var(--fp-ink)", marginBottom: 4,
            }}>Bez balíčku</div>
            <div style={{ fontSize: 11, color: !selectedPackageId ? "rgba(255,255,255,0.6)" : "var(--fp-ink-3)" }}>
              Platím za každou fotku zvlášť
            </div>
          </button>
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
        // ── Velké náhledy: přirozené výšky, 2 sloupce — fotky v plné proporci ──
        <MasonryGrid photos={filtered} numCols={isMobile ? 1 : 2} gap={isMobile ? 8 : 12}>
          {(photo) => (
            <NaturalTile key={photo.id} photo={photo}
              selected={dreambox.has(photo.id)} saving={savingId === photo.id}
              onHeart={handleHeart} onZoom={setLightboxPhoto}
              onOrientationDetect={handleOrientationDetect} />
          )}
        </MasonryGrid>

      ) : isDreamboxView && dreambox.size > 0 ? (
        // ── Dreambox: DnD na desktopu, SmartGrid na mobilu ──
        isMobile ? (
          <SmartGrid
            photos={dreamboxOrder.map(id => photos.find(ph => ph.id === id)).filter(Boolean) as GalleryPhoto[]}
            numCols={2} gap={6} rowH={120} landscapeIds={landscapeIds}
          >
            {(photo) => (
              <NaturalTile key={photo.id} photo={photo} selected saving={savingId === photo.id}
                onHeart={handleHeart} onZoom={setLightboxPhoto}
                fillHeight onOrientationDetect={handleOrientationDetect} />
            )}
          </SmartGrid>
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
        // ── Masonry výchozí: SmartGrid — portrait 1col×3rows, landscape 2col×2rows ──
        <SmartGrid
          photos={filtered}
          numCols={isMobile ? 2 : 4}
          gap={isMobile ? 6 : 10}
          rowH={isMobile ? 120 : 150}
          landscapeIds={landscapeIds}
        >
          {(photo) => (
            <NaturalTile key={photo.id} photo={photo}
              selected={dreambox.has(photo.id)} saving={savingId === photo.id}
              onHeart={handleHeart} onZoom={setLightboxPhoto}
              fillHeight onOrientationDetect={handleOrientationDetect} />
          )}
        </SmartGrid>
      )}

      {/* ── Upsell nudge ── */}
      {(() => {
        const pkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) ?? null : null;
        const pkgIdx = pkg ? PACKAGES.findIndex(p => p.id === pkg.id) : -1;
        const nextPkg = pkgIdx >= 0 && pkgIdx < PACKAGES.length - 1 ? PACKAGES[pkgIdx + 1] : null;

        let nudge: { type: "fill"; remaining: number } | { type: "upgrade"; nextPkg: typeof PACKAGES[0]; toAdd: number; priceDiff: number } | null = null;

        if (pkg) {
          const remaining = pkg.includedPhotos - dreambox.size;
          if (remaining > 0 && remaining <= 3) {
            // Close to filling — these photos are FREE
            nudge = { type: "fill", remaining };
          } else if (remaining < 0 && nextPkg) {
            // Over limit — upgrading might help
            const extraCount = -remaining;
            const currentExtraCost = extraCount * pkg.extraPhotoPrice;
            const upgradeCost = nextPkg.basePrice - pkg.basePrice;
            // Show upgrade nudge if upgrade cost is reasonably close to current extra cost
            if (upgradeCost <= currentExtraCost * 4) {
              const toAdd = nextPkg.includedPhotos - dreambox.size;
              nudge = { type: "upgrade", nextPkg, toAdd, priceDiff: upgradeCost };
            }
          }
        } else if (dreambox.size > 0) {
          // No package — if close to Mini threshold, nudge
          const mini = PACKAGES[0];
          const toMini = mini.includedPhotos - dreambox.size;
          if (toMini > 0 && toMini <= 3) {
            nudge = { type: "fill", remaining: toMini };
          }
        }

        if (!nudge) return null;

        return (
          <div style={{
            position: "fixed", bottom: dreambox.size > 0 ? (isMobile ? 134 : 100) : 24,
            left: "50%", transform: "translateX(-50%)",
            zIndex: 31, width: "auto", maxWidth: isMobile ? "calc(100vw - 24px)" : 560,
            pointerEvents: "auto",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 16px 10px 14px",
              background: nudge.type === "fill" ? "#2d5a27" : "#7a4f1a",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ fontSize: 36, flexShrink: 0, lineHeight: 1 }}>
                {nudge.type === "fill" ? "🎁" : "✨"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {nudge.type === "fill" ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                      Přidejte ještě {nudge.remaining} {nudge.remaining === 1 ? "fotku" : nudge.remaining < 5 ? "fotky" : "fotek"} — jsou zahrnuty v ceně!
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                      {pkg ? `Balíček ${pkg.name} zahrnuje ${pkg.includedPhotos} fotek` : `Balíček Mini zahrnuje ${PACKAGES[0].includedPhotos} fotek`}
                    </div>
                  </>
                ) : nudge.type === "upgrade" ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                      Upgrade na {nudge.nextPkg.name} za +{nudge.priceDiff.toLocaleString("cs-CZ")} Kč
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                      {nudge.nextPkg.includedPhotos} fotek v ceně · každá extra fotka pak jen {nudge.nextPkg.extraPhotoPrice} Kč
                    </div>
                  </>
                ) : null}
              </div>
              {nudge.type === "upgrade" && (
                <button
                  onClick={() => setPackage(nudge.type === "upgrade" ? nudge.nextPkg.id : null)}
                  style={{
                    all: "unset", cursor: "pointer", flexShrink: 0,
                    padding: "7px 14px", fontSize: 12, fontWeight: 700,
                    background: "#fff", color: "#7a4f1a",
                    letterSpacing: "0.04em",
                  }}
                >
                  Upgradovat
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Floating bottom bar ── */}
      {dreambox.size > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
          background: "rgba(22,20,18,0.97)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.06)",
        }}>
          {isMobile ? (
            /* ── Mobile ── */
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Thumbs */}
              <div style={{ display: "flex", flexShrink: 0 }}>
                {[...dreambox].slice(0, 3).map((id, i) => {
                  const p = photos.find((ph) => ph.id === id);
                  return p ? (
                    <div key={id} style={{ width: 34, height: 34, overflow: "hidden", marginLeft: i === 0 ? 0 : -8, border: "2px solid rgba(22,20,18,0.97)", background: "#443c34", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
                    </div>
                  ) : null;
                })}
                {dreambox.size > 3 && (
                  <div style={{ width: 34, height: 34, marginLeft: -8, background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, border: "2px solid rgba(22,20,18,0.97)" }}>
                    +{dreambox.size - 3}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, color: "#fff" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {selectedPackageId ? (() => {
                    const pkg = PACKAGES.find(p => p.id === selectedPackageId)!;
                    const effective = pkg.includedPhotos + usedCredits;
                    const rem = effective - dreambox.size;
                    return rem >= 0 ? `Balíček ${pkg.name} · zbývá ${rem}` : `Balíček ${pkg.name} · ${-rem} navíc`;
                  })() : `z ${photos.length} fotek`}
                </div>
                <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1.1 }}>
                  {dreambox.size} {dreambox.size === 1 ? "fotka" : dreambox.size < 5 ? "fotky" : "fotek"}
                </div>
              </div>

              {/* CTA */}
              <button onClick={() => setStep(2)} style={{
                all: "unset", cursor: "pointer",
                height: 42, padding: "0 18px",
                background: "var(--fp-accent)", color: "#fff",
                fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              }}>
                Pokračovat <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            /* ── Desktop ── */
            <div style={{
              maxWidth: 1200, margin: "0 auto",
              padding: "0 48px",
              height: 72,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            }}>
              {/* Left: count + package info */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                  <Heart size={16} strokeWidth={2} fill="var(--fp-accent)" color="var(--fp-accent)" />
                  <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 26 }}>
                    {dreambox.size}
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", paddingTop: 2 }}>
                    {dreambox.size === 1 ? "fotka" : dreambox.size < 5 ? "fotky" : "fotek"}
                  </span>
                </div>

                {selectedPackageId ? (() => {
                  const pkg = PACKAGES.find(p => p.id === selectedPackageId)!;
                  const effective = pkg.includedPhotos + usedCredits;
                  const rem = effective - dreambox.size;
                  return (
                    <div style={{
                      padding: "6px 14px", border: "1px solid rgba(255,255,255,0.12)",
                      fontSize: 12, color: rem >= 0 ? "rgba(255,255,255,0.6)" : "#f4a261",
                    }}>
                      {rem >= 0
                        ? <><span style={{ color: "#fff", fontWeight: 600 }}>Balíček {pkg.name}</span> · zbývá {rem} {rem === 1 ? "fotka" : rem < 5 ? "fotky" : "fotek"}</>
                        : <><span style={{ fontWeight: 600 }}>Balíček {pkg.name}</span> · {-rem} navíc (+{(-rem) * pkg.extraPhotoPrice} Kč)</>
                      }
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    z {photos.length} fotek
                  </div>
                )}
              </div>

              {/* Center: thumbnails */}
              <div style={{ display: "flex", flex: 1, justifyContent: "center" }}>
                <div style={{ display: "flex" }}>
                  {[...dreambox].slice(0, 7).map((id, i) => {
                    const p = photos.find((ph) => ph.id === id);
                    return p ? (
                      <div key={id} style={{ width: 38, height: 38, overflow: "hidden", marginLeft: i === 0 ? 0 : -10, border: "2.5px solid rgba(22,20,18,0.97)", background: "#3a3530", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
                      </div>
                    ) : null;
                  })}
                  {dreambox.size > 7 && (
                    <div style={{ width: 38, height: 38, marginLeft: -10, background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "2.5px solid rgba(22,20,18,0.97)" }}>
                      +{dreambox.size - 7}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: CTA */}
              <button
                onClick={() => setStep(2)}
                style={{
                  all: "unset", cursor: "pointer",
                  height: 48, padding: "0 28px",
                  background: "var(--fp-accent)", color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 8,
                  letterSpacing: "0.02em", flexShrink: 0,
                  transition: "filter 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
              >
                Pokračovat ke konfiguraci
                <ArrowRight size={16} strokeWidth={2.5} />
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
          <img src={`${BASE}${lightboxPhoto.fullUrl}`} alt={`Foto ${lightboxPhoto.num}`} onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", maxWidth: "90vw", borderRadius: 0, objectFit: "contain" }} />
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
  fillHeight?: boolean;
  onOrientationDetect?: (id: string) => void;
}

function NaturalTile({ photo, selected, saving, onHeart, onZoom, fillHeight, onOrientationDetect }: TileBaseProps) {
  const [hovered, setHovered] = useState(false);
  const isActive = hovered || selected;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onZoom(photo)}
      style={{
        position: "relative", borderRadius: 0, overflow: "hidden",
        width: "100%", height: fillHeight ? "100%" : "auto",
        cursor: "zoom-in", background: "#ddd0bc",
        display: "flex", alignItems: "center", justifyContent: "center",
        outline: selected ? "2px solid var(--fp-accent)" : "2px solid transparent",
        outlineOffset: 2,
        transition: "outline 0.15s ease",
      }}
    >
      <img
        src={`${BASE}${photo.fullUrl}`}
        alt={`Foto ${photo.num}`}
        loading="lazy"
        onLoad={onOrientationDetect ? (e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > img.naturalHeight) onOrientationDetect(photo.id);
        } : undefined}
        style={{
          display: "block",
          width: fillHeight ? "100%" : "100%",
          height: fillHeight ? "100%" : "auto",
          objectFit: fillHeight ? "contain" : undefined,
        }}
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isActive ? "linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.28) 100%)" : "transparent", transition: "background 0.2s" }} />
      {photo.isSuggested && (
        <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", background: "rgba(255,255,255,0.92)", color: "var(--fp-ink)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          <Sparkles size={9} strokeWidth={2} />Doporučené
        </div>
      )}
      <button onClick={(e) => onHeart(photo, e)} disabled={saving} style={{
        all: "unset", cursor: "pointer", position: "absolute", top: 8, right: 8,
        width: 34, height: 34,
        background: selected ? "var(--fp-accent)" : "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)", color: selected ? "#fff" : "var(--fp-ink)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: isActive ? 1 : 0.75,
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
        position: "relative", aspectRatio: "3/2", overflow: "hidden",
        borderRadius: 0, cursor: "zoom-in", background: "#ddd0bc",
        display: "flex", alignItems: "center", justifyContent: "center",
        outline: selected ? "2px solid var(--fp-accent)" : "2px solid transparent",
        outlineOffset: 2,
        transform: hovered ? "scale(1.012)" : "scale(1)",
        transition: "transform 0.2s ease, outline 0.15s ease",
      }}
    >
      <img src={`${BASE}${photo.fullUrl}`} alt={`Foto ${photo.num}`} loading="lazy"
        style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isActive ? "linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.22) 100%)" : "transparent", transition: "background 0.2s" }} />
      {photo.isSuggested && (
        <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 0, background: "rgba(255,255,255,0.92)", color: "var(--fp-ink)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
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
