"use client";

import { useState } from "react";
import {
  useGalleryStore, COLOR_LABELS, COLOR_URL_SUFFIX, PACKAGES,
  type ColorOption, type SizeOption,
} from "@/lib/gallery-store";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Link, Loader2, MoreHorizontal, Plus, Sparkles, Trash2, ZoomIn, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/asp-parsers";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GalleryStep } from "@/lib/gallery-store";

const BASE = "https://v1.fotoprome.cz";

// Append color variant suffix to a URL.
// "auto" = nechte to na nás → zobrazíme standardní barevnou verzi (žádný suffix)
function variantUrl(url: string, color: ColorOption): string {
  if (color === "auto") return url; // server nemá _a variantu náhledu
  const suffix = COLOR_URL_SUFFIX[color];
  return suffix ? url.replace(/\.jpg$/i, `${suffix}.jpg`) : url;
}

// 5 standard color options + "Nechte to na nás" as separate premium option
const COLORS: { id: ColorOption; dot: string }[] = [
  { id: "color",     dot: "conic-gradient(from 90deg, #d4859a, #c9a961, #7a9a8a, #6b88a8, #d4859a)" },
  { id: "art_color", dot: "conic-gradient(from 0deg, #c4956a, #e8c090, #a07850, #d4a870, #c4956a)" },
  { id: "bw",        dot: "linear-gradient(135deg, #1c1a17 50%, #b8b3a8 50%)" },
  { id: "sepia",     dot: "linear-gradient(135deg, #8a6a48 0%, #d4b894 100%)" },
  { id: "antique",   dot: "linear-gradient(135deg, #2a2018 40%, #7a6a50 100%)" },
];

const SIZES: { id: SizeOption; label: string; sub: string; price: number }[] = [
  { id: "retouch_only", label: "Pouze retuš", sub: "bez tisku", price: 80 },
  { id: "S",            label: "S",           sub: "15×20 cm",  price: 120 },
  { id: "M",            label: "M",           sub: "20×27 cm",  price: 220 },
  { id: "L",            label: "L",           sub: "A3 30×42",  price: 480 },
];


// PrintLine model: { color, size, qty }
// Multi-format = multiple PrintLines per photo

const S_PRICE = SIZES.find(s => s.id === "S")?.price ?? 120;

function calcTotal(
  dreamboxPhotos: GalleryPhoto[],
  configs: ReturnType<typeof useGalleryStore.getState>["configs"],
  selectedPackageId: string | null,
) {
  const pkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) : null;
  let total = pkg ? pkg.basePrice : 0;

  dreamboxPhotos.forEach((p, photoIdx) => {
    const c = configs[p.id];
    if (!c) return;
    const isIncluded = pkg ? photoIdx < pkg.includedPhotos : false;
    const isExtra = pkg ? photoIdx >= pkg.includedPhotos : false;

    for (const line of c.prints) {
      if (!line.qty) continue;
      const basePrice = SIZES.find(s => s.id === line.size)?.price ?? 0;
      if (line.size === "retouch_only") {
        total += basePrice * line.qty;
      } else if (isIncluded && line.size === "S") {
        // S covered by package
        total += 0;
      } else if (isIncluded) {
        // M/L for included photo = upgrade delta (package covers the S base)
        total += (basePrice - S_PRICE) * line.qty;
      } else if (isExtra && line.size === "S") {
        total += pkg!.extraPhotoPrice * line.qty;
      } else {
        total += basePrice * line.qty;
      }
    }
  });

  return total;
}

export function ConfiguratorStep({ cx }: { cx: string }) {
  const { photos, dreambox, configs, setConfig, setPrintLine, addPrintLine, removePrintLine, setStep, toggleHeart, selectedPackageId, setPackage } = useGalleryStore();
  const [saving, setSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [menuPid, setMenuPid] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [removing, setRemoving] = useState(false);
  const isMobile = useIsMobile();

  const dreamboxPhotos = [...dreambox]
    .map((id) => photos.find((p) => p.id === id)).filter(Boolean) as GalleryPhoto[];

  const [selectedPid, setSelectedPid] = useState(dreamboxPhotos[0]?.id ?? "");
  // Which print line is currently active (determines preview color)
  const [activePrintIdx, setActivePrintIdx] = useState(0);

  const selectedPhoto = dreamboxPhotos.find((p) => p.id === selectedPid);
  const cfg = configs[selectedPid];
  const selectedIdx = dreamboxPhotos.findIndex((p) => p.id === selectedPid);

  // When switching photos, reset active print line to 0
  function selectPhoto(pid: string) {
    setSelectedPid(pid);
    setActivePrintIdx(0);
  }

  async function removeFromFilmstrip(pid: string) {
    const photo = photos.find(p => p.id === pid);
    setRemoving(true);
    try {
      await fetch("/api/dreambox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ act: "drop", pid, did: photo?.dreamboxItemId ?? "0", zone: photo?.zone ?? "p", cx }),
      });
      toggleHeart(pid, photo?.zone ?? "p");
      const remaining = dreamboxPhotos.filter(p => p.id !== pid);
      if (pid === selectedPid && remaining.length > 0) {
        const idx = dreamboxPhotos.findIndex(p => p.id === pid);
        selectPhoto(remaining[Math.min(idx, remaining.length - 1)].id);
      }
    } catch {
      toast.error("Nepodařilo se odebrat fotku");
    } finally {
      setRemoving(false);
      setMenuPid(null);
    }
  }

  // Preview color = color of the currently active print line
  const prints = cfg?.prints ?? [];
  const safeIdx = activePrintIdx < prints.length ? activePrintIdx : 0;
  const previewColor: ColorOption = prints[safeIdx]?.color ?? "color";

  const activeLine = prints[safeIdx];

  const activePkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) ?? null : null;
  const total = calcTotal(dreamboxPhotos, configs, selectedPackageId);

  async function sharePhoto(photo: GalleryPhoto) {
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl: photo.fullUrl,
          thumbUrl: photo.thumbUrl,
          photoNum: photo.num,
          cx,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "API error");
      const url = `${window.location.origin}/share/${data.token}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
      } catch {
        // clipboard blocked (HTTP / permission) — show URL in modal
        setShareUrl(url);
      }
    } catch (err) {
      toast.error(`Nepodařilo se vytvořit odkaz: ${err instanceof Error ? err.message : "chyba"}`);
    } finally {
      setSharing(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const photo of dreamboxPhotos) {
        const c = configs[photo.id];
        if (!c) continue;
        // Aggregate quantities per color+size → ASP fields
        const fields: Record<string, number> = { c1:0, c2:0, b1:0, b2:0, s1:0, s2:0, l1:0, l2:0, o1:0, o2:0 };
        for (const line of c.prints) {
          if (!line.qty) continue;
          const prefix = ({ color:"c", art_color:"l", bw:"b", sepia:"s", antique:"o", auto:"a" } as Record<string,string>)[line.color] ?? "c";
          const sfx = line.size === "S" ? "2" : "1";
          const key = `${prefix}${sfx}`;
          fields[key] = (fields[key] ?? 0) + line.qty;
        }
        await fetch("/api/dreambox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            act: "update", pid: photo.id, did: c.did ?? "0",
            zone: c.zone ?? photo.zone, cx,
            colorA4: fields.c1, colorA5: fields.c2,
            bwA4: fields.b1,    bwA5: fields.b2,
            sepA4: fields.s1,   sepA5: fields.s2,
          }),
        });
        if (c.notes) {
          await fetch("/api/notes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ix: photo.id, notes: c.notes }),
          });
        }
      }
      toast.success("Konfigurace uložena");
      setStep(4);
    } catch {
      toast.error("Nepodařilo se uložit");
    } finally {
      setSaving(false);
    }
  }

  if (dreamboxPhotos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ color: "var(--fp-ink-3)" }}>Nejsou vybrané žádné fotky.</p>
        <button onClick={() => setStep(1)} style={{ all: "unset", cursor: "pointer", marginTop: 12, color: "var(--fp-accent)", fontSize: 14, fontWeight: 500 }}>← Zpět do galerie</button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileConfiguratorLayout
        cx={cx}
        dreamboxPhotos={dreamboxPhotos}
        selectedPid={selectedPid}
        selectPhoto={selectPhoto}
        selectedPhoto={selectedPhoto}
        selectedIdx={selectedIdx}
        cfg={cfg}
        activePrintIdx={activePrintIdx}
        setActivePrintIdx={setActivePrintIdx}
        safeIdx={safeIdx}
        previewColor={previewColor}
        total={total}
        saving={saving}
        saveAll={saveAll}
        setStep={setStep}
        selectedPackageId={selectedPackageId}
        sharePhoto={sharePhoto}
        sharing={sharing}
        shareToast={shareToast}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Share URL modal (clipboard blocked on HTTP) */}
      {shareUrl && (
        <div
          onClick={() => setShareUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: "28px 24px",
              maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-ink)", marginBottom: 8 }}>
              Odkaz ke sdílení
            </div>
            <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginBottom: 14 }}>
              Zkopírujte odkaz níže a sdílejte ho s kýmkoliv:
            </div>
            <div style={{
              display: "flex", gap: 8, alignItems: "center",
              background: "var(--fp-surface)", borderRadius: 8, padding: "10px 14px",
              border: "1px solid var(--fp-border)",
            }}>
              <span style={{
                flex: 1, fontSize: 12, fontFamily: "ui-monospace, monospace",
                color: "var(--fp-ink)", wordBreak: "break-all",
              }}>
                {shareUrl}
              </span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                  } catch {
                    // last resort: select text
                  }
                  setShareUrl(null);
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 3000);
                }}
                style={{
                  all: "unset", cursor: "pointer", flexShrink: 0,
                  background: "var(--fp-ink)", color: "#fff",
                  fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 6,
                  letterSpacing: "0.04em",
                }}
              >
                Kopírovat
              </button>
            </div>
            <button
              onClick={() => setShareUrl(null)}
              style={{
                all: "unset", cursor: "pointer", marginTop: 14, display: "block",
                fontSize: 11, color: "var(--fp-ink-3)",
              }}
            >
              Zavřít
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>Krok 2 ze 3 — Parametry</div>
          <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 34, color: "var(--fp-ink)" }}>
            Konfigurace <em>tisku</em>
          </h1>
        </div>
        <StepDots active={1} />
      </div>

      {/* ── Package status banner ── */}
      {activePkg && (() => {
        const used = dreamboxPhotos.length;
        const rem = activePkg.includedPhotos - used;
        const extra = Math.max(0, -rem);
        return (
          <div style={{
            padding: "8px 16px",
            background: extra > 0 ? "rgba(244,162,97,0.12)" : "var(--fp-accent-soft)",
            borderBottom: "1px solid var(--fp-line)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: extra > 0 ? "#c07030" : "var(--fp-accent)" }}>
                Balíček {activePkg.name} · {activePkg.includedPhotos} fotek
              </span>
              <span style={{ fontSize: 11, color: "var(--fp-ink-3)" }}>·</span>
              {rem >= 0
                ? <span style={{ fontSize: 11, color: "var(--fp-ink-3)" }}>nevyčerpaný balíček, zbývají ještě {rem} {rem === 1 ? "fotka" : rem < 5 ? "fotky" : "fotek"}</span>
                : <span style={{ fontSize: 11, color: "#c07030", fontWeight: 500 }}>{extra} {extra === 1 ? "fotka" : extra < 5 ? "fotky" : "fotek"} navíc · +{extra * activePkg.extraPhotoPrice} Kč</span>
              }
            </div>
            <button
              onClick={() => setPackage(null)}
              style={{ all: "unset", cursor: "pointer", fontSize: 10.5, color: "var(--fp-ink-4)", textDecoration: "underline" }}
            >
              změnit balíček
            </button>
          </div>
        );
      })()}

      {/* ── Photo filmstrip ── */}
      <div style={{ background: "#ddd7cc", borderBottom: "1px solid var(--fp-line)" }}>
        <div
          className="no-scrollbar"
          style={{ display: "flex", gap: 4, overflowX: "auto", padding: "10px 12px", alignItems: "center" }}
        >
          {dreamboxPhotos.map((p, photoIdx) => {
            const isActive = p.id === selectedPid;
            const thumbColor = configs[p.id]?.prints[0]?.color ?? "color";
            const lineCount = configs[p.id]?.prints?.filter(l => l.qty > 0).length ?? 0;
            const isMenuOpen = menuPid === p.id;
            const pkgStatus = activePkg
              ? photoIdx < activePkg.includedPhotos ? "included" : "extra"
              : null;
            return (
              <div
                key={p.id}
                className="filmstrip-item"
                style={{ position: "relative", flexShrink: 0, height: 80 }}
              >
                {/* Photo button */}
                <button
                  onClick={() => { selectPhoto(p.id); setMenuPid(null); }}
                  style={{
                    all: "unset", cursor: "pointer", display: "block",
                    height: 80, overflow: "hidden",
                    outline: isActive ? "2px solid var(--fp-ink)" : "2px solid transparent",
                    outlineOffset: "2px",
                    opacity: isActive ? 1 : 0.6,
                    transition: "opacity 0.2s, outline-color 0.15s",
                  }}
                >
                  <img
                    src={`${BASE}${variantUrl(p.thumbUrl, thumbColor)}`}
                    alt=""
                    style={{ height: "100%", width: "auto", display: "block" }}
                  />
                </button>
                {/* Package badge */}
                {pkgStatus && (
                  <div style={{
                    position: "absolute", bottom: 4, left: 4,
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                    padding: "2px 5px",
                    background: pkgStatus === "included" ? "rgba(28,26,23,0.75)" : "rgba(244,162,97,0.92)",
                    color: "#fff",
                    pointerEvents: "none",
                  }}>
                    {pkgStatus === "included" ? "V BAL." : "+"}
                  </div>
                )}
                {/* Options button — visible on hover via CSS */}
                <button
                  className="filmstrip-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPos({ x: rect.left, y: rect.bottom + 6 });
                    setMenuPid(isMenuOpen ? null : p.id);
                  }}
                  style={{
                    all: "unset", cursor: "pointer",
                    position: "absolute", top: 4, right: 4,
                    width: 22, height: 22,
                    background: isMenuOpen ? "var(--fp-ink)" : "rgba(28,26,23,0.55)",
                    color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "opacity 0.15s, background 0.15s",
                  }}
                >
                  <MoreHorizontal size={12} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filmstrip dropdown menu */}
      {menuPid && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuPid(null)} />
          <div style={{
            position: "fixed", top: menuPos.y, left: menuPos.x,
            zIndex: 100, minWidth: 180,
            background: "var(--fp-surface)",
            border: "1px solid var(--fp-line)",
            boxShadow: "0 8px 24px rgba(28,26,23,0.12)",
          }}>
            <button
              onClick={() => removeFromFilmstrip(menuPid)}
              disabled={removing}
              style={{
                all: "unset", cursor: removing ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", boxSizing: "border-box",
                padding: "11px 16px",
                fontSize: 13, color: removing ? "var(--fp-ink-4)" : "#c0392b",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (!removing) (e.currentTarget as HTMLElement).style.background = "#fdf2f0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {removing
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <Trash2 size={14} strokeWidth={1.8} />}
              Odebrat z výběru
            </button>
          </div>
        </>
      )}

      {/* ── 2-column layout: preview | config ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 380px",
        border: "1px solid var(--fp-line)",
        background: "var(--fp-surface)",
      }}>

        {/* ── L: photo preview — sticky ── */}
        <div style={{ background: "var(--fp-bg)", alignSelf: "start", position: "sticky", top: 80 }}>
          {selectedPhoto && (
            <div style={{ padding: 32, boxSizing: "border-box" }}>
              <div
                onClick={() => setLightboxOpen(true)}
                style={{ overflow: "hidden", background: "#e8d8c8", cursor: "zoom-in", position: "relative" }}
              >
                <img
                  key={`${selectedPhoto.id}-${previewColor}`}
                  src={`${BASE}${variantUrl(selectedPhoto.fullUrl, previewColor)}`}
                  alt={`Foto ${selectedPhoto.num}`}
                  style={{ display: "block", width: "100%", objectFit: "cover" }}
                />
                {/* Photo number — top left */}
                <div style={{
                  position: "absolute", top: 0, left: 0,
                  background: "var(--fp-ink)", color: "#fff",
                  padding: "6px 12px",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 13, fontWeight: 600, letterSpacing: "0.06em",
                  pointerEvents: "none",
                }}>
                  #{selectedPhoto.num}
                </div>
                {/* Share button */}
                <button
                  onClick={e => { e.stopPropagation(); sharePhoto(selectedPhoto); }}
                  disabled={sharing}
                  title="Sdílet náhled"
                  style={{
                    all: "unset", cursor: sharing ? "wait" : "pointer",
                    position: "absolute", top: 10, right: 52,
                    width: 34, height: 34,
                    background: shareToast ? "var(--fp-ink)" : "rgba(255,255,255,0.88)",
                    backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: sharing ? 0.6 : 1,
                    transition: "background 0.2s, opacity 0.2s",
                  }}
                >
                  {shareToast
                    ? <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", padding: "0 4px" }}>Zkopírováno!</span>
                    : <Link size={15} style={{ color: "var(--fp-ink)" }} strokeWidth={2} />
                  }
                </button>

                {/* Zoom button */}
                <div
                  onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    width: 34, height: 34,
                    background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0.5, cursor: "zoom-in",
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                >
                  <ZoomIn size={16} style={{ color: "var(--fp-ink)" }} />
                </div>
              </div>

              {/* Navigation arrows */}
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fp-ink-3)" }}>
                  {selectedIdx + 1} / {dreamboxPhotos.length}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button disabled={selectedIdx === 0} onClick={() => selectPhoto(dreamboxPhotos[selectedIdx - 1].id)} style={{
                    all: "unset", cursor: selectedIdx > 0 ? "pointer" : "default",
                    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                    color: selectedIdx > 0 ? "var(--fp-ink-2)" : "var(--fp-ink-4)",
                    border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
                  }}><ChevronLeft size={18} strokeWidth={1.7} /></button>
                  <button disabled={selectedIdx === dreamboxPhotos.length - 1} onClick={() => selectPhoto(dreamboxPhotos[selectedIdx + 1].id)} style={{
                    all: "unset", cursor: selectedIdx < dreamboxPhotos.length - 1 ? "pointer" : "default",
                    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                    color: selectedIdx < dreamboxPhotos.length - 1 ? "var(--fp-ink-2)" : "var(--fp-ink-4)",
                    border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
                  }}><ChevronRight size={18} strokeWidth={1.7} /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── R: config panel ── */}

        <div style={{ borderLeft: "1px solid var(--fp-line)", overflow: "auto", background: "var(--fp-surface)", padding: "20px 20px 100px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* ── Print lines (multi-format) ── */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
                Formáty tisku
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(cfg?.prints ?? []).map((line, idx) => {
                  const pkgSt = activePkg
                    ? selectedIdx < activePkg.includedPhotos ? "included" as const : "extra" as const
                    : null;
                  return (
                    <PrintLineRow
                      key={idx}
                      index={idx}
                      isActive={safeIdx === idx}
                      line={line}
                      onActivate={() => setActivePrintIdx(idx)}
                      onColorChange={(color) => {
                        setPrintLine(selectedPid, idx, { color });
                        setActivePrintIdx(idx);
                      }}
                      onSizeChange={(size) => setPrintLine(selectedPid, idx, { size })}
                      onQtyChange={(qty) => setPrintLine(selectedPid, idx, { qty })}
                      onRemove={() => {
                        removePrintLine(selectedPid, idx);
                        setActivePrintIdx(0);
                      }}
                      canRemove={(cfg?.prints?.length ?? 0) > 1}
                      isFirst={idx === 0}
                      packageStatus={pkgSt}
                      extraPhotoPrice={activePkg?.extraPhotoPrice}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => addPrintLine(selectedPid)}
                style={{
                  all: "unset", cursor: "pointer",
                  marginTop: 10, width: "100%", boxSizing: "border-box",
                  height: 36, borderRadius: 0,
                  border: "1.5px dashed var(--fp-line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, fontSize: 12.5, fontWeight: 500,
                  color: "var(--fp-ink-3)",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--fp-accent)"; e.currentTarget.style.color = "var(--fp-accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--fp-line)"; e.currentTarget.style.color = "var(--fp-ink-3)"; }}
              >
                <Plus size={14} strokeWidth={2} /> Přidat další formát
              </button>
            </div>

            {/* ── Note ── */}
            <ConfigField label="Poznámka k fotce">
              <textarea
                value={cfg?.notes ?? ""}
                onChange={(e) => setConfig(selectedPid, { notes: e.target.value })}
                placeholder="Např. zesvětlit pozadí, ostřejší oči…"
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 70,
                  padding: 10, borderRadius: 0,
                  background: "var(--fp-bg)", border: "1px solid var(--fp-line)",
                  fontFamily: "inherit", fontSize: 13, color: "var(--fp-ink)",
                  resize: "vertical", outline: "none",
                }}
              />
            </ConfigField>

          </div>
        </div>
      </div>

      {/* Floating footer — stejný styl jako Dreambox sticky bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: isMobile ? "0 16px" : "0 48px", zIndex: 30, pointerEvents: "none" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", marginBottom: 24,
          padding: "10px 10px 10px 20px",
          borderRadius: 0,
          background: "rgba(28,26,23,0.95)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
          boxShadow: "0 18px 40px rgba(28,26,23,0.2)",
          pointerEvents: "auto",
        }}>
          {/* Mezisoučet */}
          <div style={{ color: "#fff", paddingLeft: 6 }}>
            {activePkg ? (
              <>
                <div style={{ fontSize: 11, opacity: 0.55 }}>
                  Balíček {activePkg.name}
                  {dreamboxPhotos.length > activePkg.includedPhotos &&
                    ` + ${dreamboxPhotos.length - activePkg.includedPhotos} fotek navíc`}
                </div>
                <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22 }}>
                  {total.toLocaleString("cs-CZ")} Kč
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Mezisoučet</div>
                <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22 }}>
                  {total.toLocaleString("cs-CZ")} Kč
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{
              all: "unset", cursor: "pointer",
              height: 44, padding: "0 16px", borderRadius: 0,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              fontSize: 13.5, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <ArrowLeft size={14} strokeWidth={1.8} />Zpět
            </button>
            <button onClick={saveAll} disabled={saving} style={{
              all: "unset", cursor: saving ? "not-allowed" : "pointer",
              height: 44, padding: "0 20px", borderRadius: 0,
              background: "#fff", color: "var(--fp-ink)",
              fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
              Pokračovat na rekapitulaci <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && selectedPhoto && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(28,26,23,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); if (selectedIdx > 0) selectPhoto(dreamboxPhotos[selectedIdx - 1].id); }}
            style={{
              all: "unset", cursor: selectedIdx > 0 ? "pointer" : "default",
              position: "absolute", left: 20,
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: selectedIdx > 0 ? 1 : 0.25,
            }}
          ><ChevronLeft size={22} /></button>

          <img
            key={`lb-${selectedPhoto.id}-${previewColor}`}
            src={`${BASE}${variantUrl(selectedPhoto.fullUrl, previewColor)}`}
            alt={`Foto ${selectedPhoto.num}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "90vh", maxWidth: "90vw", borderRadius: 0, objectFit: "contain", cursor: "default" }}
          />

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); if (selectedIdx < dreamboxPhotos.length - 1) selectPhoto(dreamboxPhotos[selectedIdx + 1].id); }}
            style={{
              all: "unset", cursor: selectedIdx < dreamboxPhotos.length - 1 ? "pointer" : "default",
              position: "absolute", right: 20,
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: selectedIdx < dreamboxPhotos.length - 1 ? 1 : 0.25,
            }}
          ><ChevronRight size={22} /></button>

          {/* Close */}
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              all: "unset", cursor: "pointer",
              position: "absolute", top: 20, right: 20,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={18} /></button>

          {/* Caption */}
          <div style={{
            position: "absolute", bottom: 24,
            color: "rgba(255,255,255,0.6)", fontSize: 13,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>#{selectedPhoto.num}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{COLOR_LABELS[previewColor]}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{selectedIdx + 1} / {dreamboxPhotos.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile configurator layout ──────────────────────────────────────────────

interface MobileConfiguratorLayoutProps {
  cx: string;
  dreamboxPhotos: GalleryPhoto[];
  selectedPid: string;
  selectPhoto: (pid: string) => void;
  selectedPhoto: GalleryPhoto | undefined;
  selectedIdx: number;
  cfg: ReturnType<typeof useGalleryStore.getState>["configs"][string] | undefined;
  activePrintIdx: number;
  setActivePrintIdx: (i: number) => void;
  safeIdx: number;
  previewColor: ColorOption;
  total: number;
  saving: boolean;
  saveAll: () => void;
  setStep: (s: GalleryStep) => void;
  selectedPackageId: string | null;
  sharePhoto: (photo: GalleryPhoto) => void;
  sharing: boolean;
  shareToast: boolean;
}

function MobileConfiguratorLayout({
  cx,
  dreamboxPhotos,
  selectedPid,
  selectPhoto,
  selectedPhoto,
  selectedIdx,
  cfg,
  activePrintIdx,
  setActivePrintIdx,
  safeIdx,
  previewColor,
  total,
  saving,
  saveAll,
  setStep,
  selectedPackageId,
  sharePhoto,
  sharing,
  shareToast,
}: MobileConfiguratorLayoutProps) {
  const activePkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) ?? null : null;
  const { configs, setConfig, setPrintLine, addPrintLine, removePrintLine } = useGalleryStore();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Krok 2 ze 3 — Parametry</div>
        <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 28, color: "var(--fp-ink)" }}>
          Konfigurace <em>tisku</em>
        </h1>
      </div>

      {/* Package status — mobile */}
      {activePkg && (() => {
        const rem = activePkg.includedPhotos - dreamboxPhotos.length;
        const extra = Math.max(0, -rem);
        return (
          <div style={{
            marginBottom: 12, padding: "8px 12px",
            background: extra > 0 ? "rgba(244,162,97,0.12)" : "var(--fp-accent-soft)",
            border: "1px solid var(--fp-line)",
            fontSize: 12, color: extra > 0 ? "#c07030" : "var(--fp-accent)",
            fontWeight: 500,
          }}>
            {rem >= 0
              ? `Balíček ${activePkg.name} · zbývají ${rem} fotky`
              : `Balíček ${activePkg.name} · ${extra} fotky navíc (+${extra * activePkg.extraPhotoPrice} Kč)`}
          </div>
        );
      })()}

      {/* Horizontal thumb strip */}
      <div className="no-scrollbar" style={{
        display: "flex", gap: 8,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        paddingBottom: 8,
        marginBottom: 16,
      } as React.CSSProperties}>
        {dreamboxPhotos.map((p) => {
          const isActive = p.id === selectedPid;
          const thumbColor = configs[p.id]?.prints[0]?.color ?? "color";
          return (
            <button
              key={p.id}
              onClick={() => selectPhoto(p.id)}
              style={{
                all: "unset", cursor: "pointer", flexShrink: 0,
                width: 52, height: 52, borderRadius: 0, overflow: "hidden",
                border: isActive ? "2px solid var(--fp-accent)" : "2px solid transparent",
                background: "#e8d8c8",
                boxSizing: "border-box",
              }}
            >
              <img
                src={`${BASE}${variantUrl(p.thumbUrl, thumbColor)}`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          );
        })}
      </div>

      {/* Large photo preview */}
      {selectedPhoto && (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => setLightboxOpen(true)}
            style={{ borderRadius: 0, overflow: "hidden", background: "#e8d8c8", cursor: "zoom-in", position: "relative" }}
          >
            <img
              key={`${selectedPhoto.id}-${previewColor}`}
              src={`${BASE}${variantUrl(selectedPhoto.fullUrl, previewColor)}`}
              alt={`Foto ${selectedPhoto.num}`}
              style={{ display: "block", width: "100%", objectFit: "cover" }}
            />
            {/* Photo number — top left */}
            <div style={{
              position: "absolute", top: 0, left: 0,
              background: "var(--fp-ink)", color: "#fff",
              padding: "5px 10px",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
              pointerEvents: "none",
            }}>
              #{selectedPhoto.num}
            </div>
            {/* Share button */}
            <button
              onClick={(e) => { e.stopPropagation(); sharePhoto(selectedPhoto); }}
              disabled={sharing}
              style={{
                all: "unset", cursor: sharing ? "wait" : "pointer",
                position: "absolute", top: 10, right: 52,
                width: 34, height: 34,
                background: shareToast ? "var(--fp-ink)" : "rgba(255,255,255,0.88)",
                backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              {shareToast
                ? <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", padding: "0 3px" }}>✓</span>
                : <Link size={15} style={{ color: "var(--fp-ink)" }} strokeWidth={2} />
              }
            </button>

            <div
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              style={{
                position: "absolute", top: 10, right: 10,
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "zoom-in",
              }}
            >
              <ZoomIn size={16} style={{ color: "var(--fp-ink)" }} />
            </div>
          </div>

          {/* Nav arrows */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fp-ink-3)" }}>{selectedIdx + 1}/{dreamboxPhotos.length}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button disabled={selectedIdx === 0} onClick={() => selectPhoto(dreamboxPhotos[selectedIdx - 1].id)} style={{
                all: "unset", cursor: selectedIdx > 0 ? "pointer" : "default",
                width: 34, height: 34, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center",
                color: selectedIdx > 0 ? "var(--fp-ink-2)" : "var(--fp-ink-4)",
                border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
              }}><ChevronLeft size={18} strokeWidth={1.7} /></button>
              <button disabled={selectedIdx === dreamboxPhotos.length - 1} onClick={() => selectPhoto(dreamboxPhotos[selectedIdx + 1].id)} style={{
                all: "unset", cursor: selectedIdx < dreamboxPhotos.length - 1 ? "pointer" : "default",
                width: 34, height: 34, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center",
                color: selectedIdx < dreamboxPhotos.length - 1 ? "var(--fp-ink-2)" : "var(--fp-ink-4)",
                border: "1px solid var(--fp-line)", background: "var(--fp-surface)",
              }}><ChevronRight size={18} strokeWidth={1.7} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Print line cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {(cfg?.prints ?? []).map((line, idx) => {
          const pkgSt = activePkg
            ? selectedIdx < activePkg.includedPhotos ? "included" as const : "extra" as const
            : null;
          return (
            <PrintLineRow
              key={idx}
              index={idx}
              isActive={safeIdx === idx}
              line={line}
              onActivate={() => setActivePrintIdx(idx)}
              onColorChange={(color) => {
                setPrintLine(selectedPid, idx, { color });
                setActivePrintIdx(idx);
              }}
              onSizeChange={(size) => setPrintLine(selectedPid, idx, { size })}
              onQtyChange={(qty) => setPrintLine(selectedPid, idx, { qty })}
              onRemove={() => {
                removePrintLine(selectedPid, idx);
                setActivePrintIdx(0);
              }}
              canRemove={(cfg?.prints?.length ?? 0) > 1}
              isFirst={idx === 0}
              packageStatus={pkgSt}
              extraPhotoPrice={activePkg?.extraPhotoPrice}
            />
          );
        })}
        <button
          onClick={() => addPrintLine(selectedPid)}
          style={{
            all: "unset", cursor: "pointer",
            width: "100%", boxSizing: "border-box",
            height: 36, borderRadius: 0,
            border: "1.5px dashed var(--fp-line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, fontSize: 12.5, fontWeight: 500,
            color: "var(--fp-ink-3)",
          }}
        >
          <Plus size={14} strokeWidth={2} /> Přidat další formát
        </button>
      </div>

      {/* Note */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>Poznámka k fotce</div>
        <textarea
          value={cfg?.notes ?? ""}
          onChange={(e) => setConfig(selectedPid, { notes: e.target.value })}
          placeholder="Např. zesvětlit pozadí, ostřejší oči…"
          style={{
            width: "100%", boxSizing: "border-box", minHeight: 70,
            padding: 10, borderRadius: 0,
            background: "var(--fp-bg)", border: "1px solid var(--fp-line)",
            fontFamily: "inherit", fontSize: 13, color: "var(--fp-ink)",
            resize: "vertical", outline: "none",
          }}
        />
      </div>

      {/* Floating bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "0 16px", zIndex: 30, pointerEvents: "none" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", marginBottom: 24,
          padding: "10px 10px 10px 20px",
          borderRadius: 0,
          background: "rgba(28,26,23,0.95)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
          boxShadow: "0 18px 40px rgba(28,26,23,0.2)",
          pointerEvents: "auto",
        }}>
          <div style={{ color: "#fff", paddingLeft: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Mezisoučet</div>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22 }}>
              {total.toLocaleString("cs-CZ")} Kč
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{
              all: "unset", cursor: "pointer",
              height: 44, padding: "0 16px", borderRadius: 0,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              fontSize: 13.5, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <ArrowLeft size={14} strokeWidth={1.8} />Zpět
            </button>
            <button onClick={saveAll} disabled={saving} style={{
              all: "unset", cursor: saving ? "not-allowed" : "pointer",
              height: 44, padding: "0 20px", borderRadius: 0,
              background: "#fff", color: "var(--fp-ink)",
              fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
              Pokračovat <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && selectedPhoto && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(28,26,23,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            key={`lb-${selectedPhoto.id}-${previewColor}`}
            src={`${BASE}${variantUrl(selectedPhoto.fullUrl, previewColor)}`}
            alt={`Foto ${selectedPhoto.num}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "90vh", maxWidth: "90vw", borderRadius: 0, objectFit: "contain", cursor: "default" }}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              all: "unset", cursor: "pointer",
              position: "absolute", top: 20, right: 20,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={18} /></button>
        </div>
      )}
    </div>
  );
}

// ── Single print line row ──

interface PrintLineRowProps {
  line: { color: ColorOption; size: SizeOption; qty: number };
  index: number;
  isActive: boolean;
  onActivate: () => void;
  onColorChange: (c: ColorOption) => void;
  onSizeChange: (s: SizeOption) => void;
  onQtyChange: (q: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  isFirst: boolean;
  packageStatus?: "included" | "extra" | null;
  extraPhotoPrice?: number;
}

function PrintLineRow({ line, index, isActive, onActivate, onColorChange, onSizeChange, onQtyChange, onRemove, canRemove, packageStatus, extraPhotoPrice }: PrintLineRowProps) {
  const basePrice = SIZES.find((s) => s.id === line.size)?.price ?? 0;
  // Package-aware effective price per unit
  const effectiveUnitPrice =
    packageStatus === "included" && line.size === "S" ? 0 :
    packageStatus === "included" && line.size !== "S" && line.size !== "retouch_only" ? basePrice - S_PRICE :
    packageStatus === "extra"    && line.size === "S" ? (extraPhotoPrice ?? basePrice) :
    basePrice;
  const lineTotal = effectiveUnitPrice * line.qty;
  const colorDef  = COLORS.find((c) => c.id === line.color) ?? COLORS[0];

  return (
    <div
      onClick={onActivate}
      style={{
      background: "var(--fp-surface)",
      borderRadius: 0,
      // Aktivní řádek = výrazný accent border, ostatní = jemná čára
      border: isActive ? "2px solid var(--fp-accent)" : "1px solid var(--fp-line)",
      // Kompenzuj 1px rozdíl okraje aby se layout neskákal
      margin: isActive ? "0" : "1px",
      overflow: "hidden",
      cursor: "pointer",
      boxShadow: isActive ? "0 0 0 3px var(--fp-accent-soft), var(--fp-shadow-sm)" : "var(--fp-shadow-sm)",
      transition: "border 0.15s, box-shadow 0.15s",
    }}>

      {/* Card header — summary + remove */}
      <div style={{
        padding: "12px 16px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--fp-line)",
        background: "var(--fp-bg)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Numbered badge */}
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "var(--fp-ink)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>{index + 1}</div>

          {/* Summary pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: colorDef.dot, flexShrink: 0,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
            }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fp-ink)" }}>
              {COLOR_LABELS[line.color]}
            </span>
            {line.size !== "retouch_only" && (
              <>
                <span style={{ color: "var(--fp-ink-4)", fontSize: 10 }}>·</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fp-ink)" }}>
                  {SIZES.find(s => s.id === line.size)?.label}
                </span>
                <span style={{ color: "var(--fp-ink-4)", fontSize: 10 }}>·</span>
                <span style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>×{line.qty}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {packageStatus === "included" && line.size === "S" ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-accent)", background: "var(--fp-accent-soft)", padding: "2px 8px" }}>
              V balíčku · 0 Kč
            </span>
          ) : packageStatus === "included" && line.size !== "S" && line.size !== "retouch_only" ? (
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 17, color: "var(--fp-ink)" }}>
                {lineTotal.toLocaleString("cs-CZ")} Kč
              </span>
              <div style={{ fontSize: 10, color: "var(--fp-ink-3)", marginTop: 1 }}>upgrade z balíčku</div>
            </div>
          ) : packageStatus === "extra" && line.size === "S" ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#c07030", background: "rgba(244,162,97,0.15)", padding: "2px 8px" }}>
              +{extraPhotoPrice} Kč / ks
            </span>
          ) : lineTotal > 0 ? (
            <span style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 17, color: "var(--fp-ink)",
            }}>{lineTotal.toLocaleString("cs-CZ")} Kč</span>
          ) : null}
          {canRemove && (
            <button onClick={onRemove} title="Odstranit" style={{
              all: "unset", cursor: "pointer",
              width: 26, height: 26, borderRadius: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--fp-ink-4)", fontSize: 16, lineHeight: 1,
              transition: "color 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--fp-ink-4)")}
            >✕</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Barevnost ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>
            Barevnost
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {COLORS.map((c) => {
              const isActive = line.color === c.id;
              return (
                <button key={c.id} onClick={() => onColorChange(c.id)} title={COLOR_LABELS[c.id]} style={{
                  all: "unset", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: c.dot,
                    boxShadow: isActive
                      ? `0 0 0 3px var(--fp-surface), 0 0 0 5px var(--fp-accent)`
                      : "0 0 0 1.5px rgba(28,26,23,0.10)",
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.18s ease",
                  }} />
                  <span style={{
                    fontSize: 10.5, fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--fp-accent)" : "var(--fp-ink-3)",
                    whiteSpace: "nowrap", transition: "color 0.15s",
                  }}>{COLOR_LABELS[c.id]}</span>
                </button>
              );
            })}
          </div>

          {/* "Nechte to na nás" — prémiová volba */}
          {(() => {
            const isAutoActive = line.color === "auto";
            return (
              <button
                onClick={() => onColorChange("auto")}
                style={{
                  all: "unset", cursor: "pointer",
                  marginTop: 12, width: "100%", boxSizing: "border-box",
                  padding: "11px 14px", borderRadius: 0,
                  display: "flex", alignItems: "center", gap: 10,
                  border: isAutoActive ? "2px solid var(--fp-accent)" : "1.5px solid var(--fp-line)",
                  background: isAutoActive ? "var(--fp-accent-soft)" : "var(--fp-bg)",
                  transition: "all 0.15s ease",
                  boxShadow: isAutoActive ? "0 0 0 3px var(--fp-accent-soft)" : "none",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #d4859a 0%, #c9a961 35%, #7a9a8a 65%, #6b88a8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isAutoActive ? `0 0 0 2px var(--fp-surface), 0 0 0 4px var(--fp-accent)` : "0 0 0 1.5px rgba(28,26,23,0.1)",
                  transform: isAutoActive ? "scale(1.05)" : "scale(1)",
                  transition: "all 0.18s",
                }}>
                  <Sparkles size={16} strokeWidth={1.8} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: isAutoActive ? "var(--fp-accent)" : "var(--fp-ink)" }}>
                    Nechte to na nás
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginTop: 2 }}>
                    Fotograf vybere nejvhodnější zpracování
                  </div>
                </div>
                {isAutoActive && (
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--fp-accent)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>✓</div>
                )}
              </button>
            );
          })()}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--fp-line)" }} />

        {/* ── Size cards ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>
            Formát
          </div>
          {/* 4 formátové karty — vždy stejná šířka, nikdy se nerozlézají */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {SIZES.map((s) => {
              const isSel = line.size === s.id;
              return (
                <button key={s.id} onClick={(e) => { e.stopPropagation(); onSizeChange(s.id); }} style={{
                  all: "unset", cursor: "pointer",
                  padding: "10px 4px 8px", borderRadius: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  border: isSel ? "2px solid var(--fp-ink)" : "1.5px solid var(--fp-line)",
                  background: isSel ? "var(--fp-ink)" : "var(--fp-bg)",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}>
                  <span style={{
                    fontSize: s.id === "retouch_only" ? 11 : 17, fontWeight: 700,
                    fontFamily: s.id === "retouch_only" ? "inherit" : '"Instrument Serif", Georgia, serif',
                    color: isSel ? "#fff" : "var(--fp-ink)", lineHeight: 1,
                  }}>
                    {s.id === "retouch_only" ? "✦" : s.label}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 500, color: isSel ? "rgba(255,255,255,0.65)" : "var(--fp-ink-3)", lineHeight: 1.3 }}>
                    {s.sub}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2, color: isSel ? "rgba(255,255,255,0.8)" : "var(--fp-ink-2)" }}>
                    {packageStatus === "included" && s.id === "S"
                      ? "0 Kč"
                      : packageStatus === "included" && s.id !== "S" && s.id !== "retouch_only"
                      ? `+${s.price - S_PRICE} Kč`
                      : packageStatus === "extra" && s.id === "S"
                      ? `+${extraPhotoPrice} Kč`
                      : `${s.price} Kč`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Qty stepper — plná šířka, nízký, pod formáty ── */}
        {line.size !== "retouch_only" && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fp-ink-4)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
              Počet kusů
            </div>
            {/* Stepper roztažen na 100% šířky — stejně jako grid formátů */}
            <div style={{
              display: "flex", alignItems: "center",
              border: "1.5px solid var(--fp-line)", borderRadius: 0,
              background: "var(--fp-bg)", overflow: "hidden", height: 34,
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onQtyChange(Math.max(1, line.qty - 1)); }}
                style={{
                  all: "unset", cursor: line.qty <= 1 ? "default" : "pointer",
                  width: 40, height: "100%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: line.qty <= 1 ? "var(--fp-ink-4)" : "var(--fp-ink-2)",
                  fontSize: 18, borderRight: "1px solid var(--fp-line)",
                }}>−</button>

              {/* Střed: počet + cena — roztahuje se */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-ink)" }}>
                  {line.qty} ks
                </span>
                {effectiveUnitPrice > 0 && line.qty >= 1 && (
                  <span style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>
                    · {effectiveUnitPrice * line.qty} Kč
                  </span>
                )}
                {effectiveUnitPrice === 0 && (
                  <span style={{ fontSize: 11, color: "var(--fp-accent)", fontWeight: 600 }}>· 0 Kč</span>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onQtyChange(line.qty + 1); }}
                style={{
                  all: "unset", cursor: "pointer",
                  width: 40, height: "100%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--fp-ink-2)", fontSize: 18,
                  borderLeft: "1px solid var(--fp-line)",
                }}>+</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Tlačítko koše — odebere fotku z Dreamboxu přímo z konfigurátoru ────────

function RemoveFromDreambox({
  photoId, cx, isActive, onRemoved,
}: {
  photoId: string; cx: string; isActive: boolean; onRemoved: () => void;
}) {
  const { toggleHeart, photos } = useGalleryStore();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 2500); return; }
    setLoading(true);
    try {
      const photo = photos.find(p => p.id === photoId);
      await fetch("/api/dreambox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          act: "drop", pid: photoId,
          did: photo?.dreamboxItemId ?? "0",
          zone: photo?.zone ?? "p", cx,
        }),
      });
      toggleHeart(photoId, photo?.zone ?? "p");
      onRemoved();
    } catch {
      toast.error("Nepodařilo se odebrat fotku");
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      title={confirm ? "Klikni znovu pro potvrzení" : "Odebrat z výběru"}
      style={{
        all: "unset", cursor: "pointer",
        width: 32, height: 72, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: confirm ? "#c0392b" : "var(--fp-ink-4)",
        background: confirm ? "rgba(192,57,43,0.08)" : "transparent",
        transition: "color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { if (!confirm) e.currentTarget.style.color = "var(--fp-ink-2)"; }}
      onMouseLeave={e => { if (!confirm) e.currentTarget.style.color = "var(--fp-ink-4)"; }}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
        : <Trash2 size={14} strokeWidth={confirm ? 2.5 : 1.8} />
      }
    </button>
  );
}

function StepDots({ active }: { active: number }) {
  const labels = ["Výběr fotek", "Parametry", "Rekapitulace"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: i < labels.length - 1 ? 10 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: i === active ? 1 : 0.45 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: i < active ? "var(--fp-ink)" : (i === active ? "var(--fp-accent)" : "transparent"),
              border: i > active ? "1px solid var(--fp-ink-4)" : "none",
              color: (i <= active) ? "#fff" : "var(--fp-ink-3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
            }}>{i < active ? "✓" : i + 1}</div>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: i === active ? "var(--fp-ink)" : "var(--fp-ink-3)" }}>{l}</span>
          </div>
          {i < labels.length - 1 && <div style={{ width: 20, height: 1, background: "var(--fp-line)", marginLeft: 8 }} />}
        </div>
      ))}
    </div>
  );
}
