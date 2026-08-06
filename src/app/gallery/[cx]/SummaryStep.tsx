"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useGalleryStore, SIZE_LABELS, COLOR_LABELS, ADDON_PRODUCTS, PACKAGES,
  RETOUCH_LABELS, RETOUCH_PRICES, type ColorOption, type SizeOption, type RetouchLevel,
} from "@/lib/gallery-store";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Trash2, Plus, Minus, X, Check } from "lucide-react";
import type { GalleryPhoto } from "@/lib/asp-parsers";
import { useIsMobile } from "@/hooks/useIsMobile";

const BASE = "https://v1.fotoprome.cz";

const PRICE_MAP: Record<string, number> = { retouch_only: 80, S: 120, M: 220, L: 480 };
const S_PRICE = PRICE_MAP.S;

const SIZES: { id: SizeOption; label: string; sub: string }[] = [
  { id: "S",            label: "S",     sub: "15×20" },
  { id: "M",            label: "M",     sub: "20×27" },
  { id: "L",            label: "L",     sub: "30×42" },
  { id: "retouch_only", label: "Retuš", sub: "bez tisku" },
];

const COLOR_DOTS: { id: ColorOption; dot: string }[] = [
  { id: "color",     dot: "conic-gradient(from 90deg, #d4859a, #c9a961, #7a9a8a, #6b88a8, #d4859a)" },
  { id: "art_color", dot: "conic-gradient(from 0deg, #c4956a, #e8c090, #a07850, #d4a870, #c4956a)" },
  { id: "bw",        dot: "linear-gradient(135deg, #1c1a17 50%, #b8b3a8 50%)" },
  { id: "sepia",     dot: "linear-gradient(135deg, #8a6a48 0%, #d4b894 100%)" },
  { id: "antique",   dot: "linear-gradient(135deg, #2a2018 40%, #7a6a50 100%)" },
  { id: "auto",      dot: "linear-gradient(135deg, #d4859a 0%, #c9a961 35%, #7a9a8a 65%, #6b88a8 100%)" },
];

export function SummaryStep({ cx }: { cx: string }) {
  const router = useRouter();
  const {
    photos, dreambox, configs, addons, globalNotes, setGlobalNotes,
    globalRetouchLevel, setGlobalRetouchLevel, delivery,
    setStep, reset, selectedPackageId, usedCredits,
    setPrintLine, addPrintLine, removePrintLine, toggleHeart,
  } = useGalleryStore();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [editingPid, setEditingPid] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const dreamboxPhotos = [...dreambox].map((id) => photos.find((p) => p.id === id)).filter(Boolean) as GalleryPhoto[];
  const activePkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) ?? null : null;

  // Package-aware print subtotal
  let printSubtotal = activePkg ? activePkg.basePrice : 0;
  const extraPhotosCount = activePkg ? Math.max(0, dreamboxPhotos.length - activePkg.includedPhotos) : 0;
  dreamboxPhotos.forEach((p, photoIdx) => {
    const c = configs[p.id];
    if (!c) return;
    const isIncluded = activePkg ? photoIdx < activePkg.includedPhotos : false;
    const isExtra = activePkg ? photoIdx >= activePkg.includedPhotos : false;
    c.prints.forEach(l => {
      if (!l.qty) return;
      const price = PRICE_MAP[l.size] ?? 0;
      if (l.size === "retouch_only") { printSubtotal += price * l.qty; return; }
      if (isIncluded && l.size === "S") { printSubtotal += 0; return; }
      if (isIncluded) { printSubtotal += (price - S_PRICE) * l.qty; return; }
      if (isExtra && l.size === "S") { printSubtotal += activePkg!.extraPhotoPrice * l.qty; return; }
      printSubtotal += price * l.qty;
    });
  });

  const retouchUnitPrice = RETOUCH_PRICES[globalRetouchLevel];
  const retouchTotal = retouchUnitPrice * dreamboxPhotos.length;

  const addonsSubtotal = addons.reduce((s, a) => s + a.price, 0);
  const shipping = delivery === 2 ? 99 : 0;
  const subtotal = printSubtotal + retouchTotal + addonsSubtotal;
  const total = subtotal + shipping;

  function removePhoto(photo: GalleryPhoto) {
    const c = configs[photo.id];
    toggleHeart(photo.id, c?.zone ?? "p", c?.did);
    if (editingPid === photo.id) setEditingPid(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cx, delivery, paper: 1, coupon: "", globalComments: globalNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrderId(data.orderId);

      if (activePkg) {
        const effectiveIncluded = activePkg.includedPhotos + usedCredits;
        const unused = effectiveIncluded - dreamboxPhotos.length;
        if (unused > 0) {
          await fetch("/api/credits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "earn", cx, packageName: activePkg.name, unused }),
          }).catch(() => {});
        }
      }

      setDone(true);
      toast.success("Objednávka odeslána!");
    } catch {
      toast.error("Odeslání se nezdařilo. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const earnedCredits = (() => {
      if (!activePkg) return 0;
      const effectiveIncluded = activePkg.includedPhotos + usedCredits;
      return Math.max(0, effectiveIncluded - dreamboxPhotos.length);
    })();

    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e3ebe2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle2 size={36} style={{ color: "#4a6a4f" }} />
        </div>
        <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 36, margin: "0 0 10px" }}>Hotovo!</h2>
        <p style={{ color: "var(--fp-ink-3)", fontSize: 15 }}>
          Vaše objednávka byla úspěšně odeslána.{orderId && <> Číslo: <strong>O{orderId}</strong>.</>}
        </p>
        <p style={{ color: "var(--fp-ink-3)", fontSize: 13, maxWidth: 380, margin: "8px auto 32px" }}>
          Fotograf ji co nejdříve zpracuje. O dokončení vás informujeme e-mailem.
        </p>
        {earnedCredits > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "12px 20px", marginBottom: 28,
            background: "rgba(45,90,39,0.08)", border: "1px solid rgba(45,90,39,0.3)",
          }}>
            <span style={{ fontSize: 22 }}>🎟️</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2d5a27" }}>
                {earnedCredits} {earnedCredits === 1 ? "fotka" : earnedCredits < 5 ? "fotky" : "fotek"} připsáno jako kredit
              </div>
              <div style={{ fontSize: 11, color: "#2d5a27", opacity: 0.75 }}>
                Využijete je při příští objednávce
              </div>
            </div>
          </div>
        )}
        <div>
          <button onClick={() => { reset(); router.push("/dashboard"); }} style={{
            all: "unset", cursor: "pointer", height: 44, padding: "0 24px",
            border: "1px solid var(--fp-line)", fontSize: 14, fontWeight: 500, color: "var(--fp-ink)",
          }}>
            Zpět na přehled
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>Krok 3 ze 3</div>
          <h1 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 36, color: "var(--fp-ink)" }}>
            Rekapitulace <em>objednávky</em>
          </h1>
          {activePkg && (
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "var(--fp-ink)", color: "#fff" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Balíček {activePkg.name}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>·</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {Math.min(dreamboxPhotos.length, activePkg.includedPhotos)}/{activePkg.includedPhotos} fotek
                {extraPhotosCount > 0 && ` + ${extraPhotosCount} navíc`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 24, alignItems: "start" }}>
        {/* Left: items table */}
        <div>
          <div style={{ background: "var(--fp-surface)", border: "1px solid var(--fp-line)", overflow: "hidden" }}>
            {/* Table header — desktop only */}
            {!isMobile && (
              <div style={{
                padding: "10px 16px 10px 20px", borderBottom: "1px solid var(--fp-line)",
                display: "grid", gridTemplateColumns: "200px 1fr 100px",
                fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)",
                textTransform: "uppercase", letterSpacing: "0.14em",
              }}>
                <span>Fotografie</span><span>Formát</span><span style={{ textAlign: "right" }}>Cena</span>
              </div>
            )}

            {dreamboxPhotos.map((p, photoIdx) => {
              const c = configs[p.id];
              const prints = c?.prints ?? [];
              const isEditing = editingPid === p.id;
              const isIncluded = activePkg ? photoIdx < activePkg.includedPhotos : false;
              const isExtra = activePkg ? photoIdx >= activePkg.includedPhotos : false;

              function linePrice(size: SizeOption, qty: number): number {
                const base = PRICE_MAP[size] ?? 0;
                if (size === "retouch_only") return base * qty;
                if (isIncluded && size === "S") return 0;
                if (isIncluded) return (base - S_PRICE) * qty;
                if (isExtra && size === "S") return (activePkg?.extraPhotoPrice ?? base) * qty;
                return base * qty;
              }

              const photoBlock = (
                <>
                  {/* Photo header row */}
                  <div style={{
                    display: "flex", gap: 12, alignItems: "center",
                    padding: isMobile ? "12px 14px" : "12px 16px 12px 20px",
                    borderBottom: "1px solid var(--fp-line)",
                    background: isEditing ? "var(--fp-accent-soft)" : "var(--fp-bg)",
                  }}>
                    {/* Thumb */}
                    <div style={{ width: 72, height: 48, flexShrink: 0, overflow: "hidden", background: "#e8d8c8", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
                      {activePkg && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          fontSize: 8, fontWeight: 700, textAlign: "center", padding: "1px 0",
                          background: isIncluded ? "rgba(45,90,39,0.85)" : "rgba(180,100,0,0.85)",
                          color: "#fff", letterSpacing: "0.04em",
                        }}>
                          {isIncluded ? "V BAL." : "NAVÍC"}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fp-ink-3)" }}>#{p.num}</div>
                      {c?.notes && <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginTop: 2, fontStyle: "italic" }}>„{c.notes}&quot;</div>}
                      {prints.filter(l => l.qty > 0).length === 0 && (
                        <div style={{ fontSize: 12, color: "var(--fp-ink-4)", marginTop: 2 }}>Nekonfigurováno</div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => setEditingPid(isEditing ? null : p.id)}
                        title={isEditing ? "Zavřít úpravy" : "Upravit formáty"}
                        style={{
                          all: "unset", cursor: "pointer",
                          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                          border: "1px solid var(--fp-line)",
                          background: isEditing ? "var(--fp-accent)" : "transparent",
                          color: isEditing ? "#fff" : "var(--fp-ink-3)",
                          transition: "all 0.15s",
                        }}
                      >
                        {isEditing ? <Check size={14} /> : <Pencil size={14} />}
                      </button>
                      <button
                        onClick={() => removePhoto(p)}
                        title="Odebrat fotku"
                        style={{
                          all: "unset", cursor: "pointer",
                          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                          border: "1px solid var(--fp-line)",
                          color: "var(--fp-ink-3)",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c0392b"; (e.currentTarget as HTMLElement).style.borderColor = "#c0392b"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--fp-ink-3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-line)"; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Print lines — view or edit */}
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <div style={{ padding: "12px 16px", background: "rgba(var(--fp-accent-rgb, 160,120,80), 0.04)", borderBottom: "1px solid var(--fp-line)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {prints.map((line, li) => (
                          <div key={li} style={{
                            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                            padding: "10px 12px",
                            background: "var(--fp-bg)", border: "1px solid var(--fp-line)",
                          }}>
                            {/* Size buttons */}
                            <div style={{ display: "flex", gap: 4 }}>
                              {SIZES.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => setPrintLine(p.id, li, { size: s.id })}
                                  title={`${s.label} ${s.sub}`}
                                  style={{
                                    all: "unset", cursor: "pointer",
                                    padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                    border: line.size === s.id ? "1.5px solid var(--fp-accent)" : "1px solid var(--fp-line)",
                                    background: line.size === s.id ? "var(--fp-accent-soft)" : "transparent",
                                    color: line.size === s.id ? "var(--fp-accent)" : "var(--fp-ink-3)",
                                    transition: "all 0.12s",
                                  }}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>

                            {/* Color dots */}
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              {COLOR_DOTS.map(cd => (
                                <button
                                  key={cd.id}
                                  onClick={() => setPrintLine(p.id, li, { color: cd.id })}
                                  title={COLOR_LABELS[cd.id]}
                                  style={{
                                    all: "unset", cursor: "pointer",
                                    width: 20, height: 20, borderRadius: "50%",
                                    background: cd.dot,
                                    boxShadow: line.color === cd.id
                                      ? "0 0 0 2px var(--fp-bg), 0 0 0 3.5px var(--fp-accent)"
                                      : "0 0 0 1px rgba(28,26,23,0.15)",
                                    transform: line.color === cd.id ? "scale(1.15)" : "scale(1)",
                                    transition: "all 0.15s",
                                  }}
                                />
                              ))}
                            </div>

                            {/* Qty stepper */}
                            <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "auto" }}>
                              <button
                                onClick={() => line.qty > 1 && setPrintLine(p.id, li, { qty: line.qty - 1 })}
                                style={{
                                  all: "unset", cursor: line.qty > 1 ? "pointer" : "default",
                                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "1px solid var(--fp-line)", fontSize: 14,
                                  color: line.qty > 1 ? "var(--fp-ink)" : "var(--fp-ink-4)",
                                }}
                              >
                                <Minus size={12} />
                              </button>
                              <div style={{
                                width: 32, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                borderTop: "1px solid var(--fp-line)", borderBottom: "1px solid var(--fp-line)",
                                fontSize: 13, fontWeight: 600, fontFamily: "ui-monospace, monospace",
                              }}>
                                {line.qty}
                              </div>
                              <button
                                onClick={() => setPrintLine(p.id, li, { qty: line.qty + 1 })}
                                style={{
                                  all: "unset", cursor: "pointer",
                                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "1px solid var(--fp-line)", fontSize: 14, color: "var(--fp-ink)",
                                }}
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            {/* Price */}
                            <div style={{
                              fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, monospace",
                              color: linePrice(line.size, line.qty) === 0 ? "#2d8a4e" : "var(--fp-ink)",
                              minWidth: 52, textAlign: "right",
                            }}>
                              {linePrice(line.size, line.qty) === 0 ? "zdarma" : `${linePrice(line.size, line.qty)} Kč`}
                            </div>

                            {/* Remove line */}
                            {prints.length > 1 && (
                              <button
                                onClick={() => removePrintLine(p.id, li)}
                                style={{
                                  all: "unset", cursor: "pointer",
                                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "var(--fp-ink-4)",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c0392b"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--fp-ink-4)"; }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add format button */}
                      <button
                        onClick={() => addPrintLine(p.id)}
                        style={{
                          all: "unset", cursor: "pointer",
                          marginTop: 8, width: "100%", boxSizing: "border-box",
                          padding: "8px 12px", border: "1px dashed var(--fp-line)",
                          display: "flex", alignItems: "center", gap: 6,
                          fontSize: 12, color: "var(--fp-ink-3)",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-accent)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-accent)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-line)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-ink-3)"; }}
                      >
                        <Plus size={13} />
                        Přidat formát
                      </button>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    prints.filter(l => l.qty > 0).length > 0 && (
                      <div>
                        {prints.filter(l => l.qty > 0).map((line, li) => (
                          <div key={li} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: isMobile ? "9px 14px" : "9px 16px 9px 20px",
                            borderBottom: li < prints.filter(l => l.qty > 0).length - 1 ? "1px solid var(--fp-line)" : "none",
                            background: li % 2 === 0 ? "transparent" : "rgba(26,23,20,0.025)",
                          }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {/* Color dot */}
                              <div style={{
                                width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                                background: COLOR_DOTS.find(cd => cd.id === line.color)?.dot ?? "#ccc",
                              }} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>
                                {line.size === "retouch_only" ? "Pouze retuš" : SIZE_LABELS[line.size].split(" ")[0]}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--fp-ink-3)" }}>{COLOR_LABELS[line.color]}</span>
                              <span style={{ fontSize: 11, color: "var(--fp-ink-4)" }}>×{line.qty}</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: "ui-monospace, monospace" }}>
                              {linePrice(line.size, line.qty) === 0
                                ? <span style={{ color: "#2d8a4e", fontSize: 11 }}>zdarma</span>
                                : `${linePrice(line.size, line.qty).toLocaleString("cs-CZ")} Kč`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              );

              if (isMobile) {
                return (
                  <div key={p.id} style={{ borderBottom: "1px solid var(--fp-line)" }}>
                    {photoBlock}
                  </div>
                );
              }

              return (
                <div key={p.id} style={{ borderBottom: "1px solid var(--fp-line)" }}>
                  {photoBlock}
                </div>
              );
            })}
          </div>

          {/* Note */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>Poznámka k objednávce</div>
            <textarea
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              placeholder="Cokoli, co bychom měli vědět o této objednávce…"
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 80,
                padding: 14, borderRadius: 0,
                background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
                fontFamily: "inherit", fontSize: 13.5, color: "var(--fp-ink)",
                resize: "vertical", outline: "none",
              }}
            />
          </div>

          {/* Míra retuší */}
          <RetouchSlider value={globalRetouchLevel} onChange={setGlobalRetouchLevel} photoCount={dreamboxPhotos.length} />

          {/* Doplňky z Kroku 3 */}
          {addons.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 22 }}>Doplňkové produkty</h2>
                <button onClick={() => setStep(2)} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "var(--fp-accent)", fontWeight: 500 }}>
                  Upravit
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {addons.map((addon) => {
                  const product = ADDON_PRODUCTS.find((p) => p.id === addon.productId);
                  const variant = product?.variants.find((v) => v.id === addon.variantId);
                  const previewPhotos = addon.photoIds.slice(0, 3)
                    .map((id) => photos.find((p) => p.id === id))
                    .filter(Boolean) as GalleryPhoto[];
                  if (!product) return null;
                  return (
                    <div key={addon.productId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--fp-bg)", border: "1px solid var(--fp-line)" }}>
                      <div style={{ display: "flex", flexShrink: 0 }}>
                        {previewPhotos.map((p, i) => (
                          <div key={p.id} style={{ width: 36, height: 36, overflow: "hidden", marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--fp-surface)", background: "#e8d8c8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${BASE}${p.fullUrl}`} alt="" style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
                          </div>
                        ))}
                        {addon.photoIds.length > 3 && (
                          <div style={{ width: 36, height: 36, marginLeft: -8, background: "var(--fp-line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, border: "2px solid var(--fp-surface)" }}>
                            +{addon.photoIds.length - 3}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{product.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--fp-ink-3)", marginTop: 2 }}>
                          {variant?.label} · {addon.photoIds.length} {addon.photoIds.length === 1 ? "fotka" : "fotek"}
                        </div>
                      </div>
                      <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                        {addon.price.toLocaleString("cs-CZ")} Kč
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: summary sidebar */}
        <div style={{
          background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
          padding: 22, position: "sticky", top: 80,
        }}>
          <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, marginBottom: 16 }}>Souhrn</div>

          {activePkg ? (
            <>
              <SumLine
                label={`Balíček ${activePkg.name} · ${Math.min(dreamboxPhotos.length, activePkg.includedPhotos)} fotek`}
                value={`${activePkg.basePrice.toLocaleString("cs-CZ")} Kč`}
              />
              {extraPhotosCount > 0 && (
                <SumLine
                  label={`${extraPhotosCount} ${extraPhotosCount === 1 ? "fotka" : extraPhotosCount < 5 ? "fotky" : "fotek"} navíc`}
                  value={`+${(extraPhotosCount * activePkg.extraPhotoPrice).toLocaleString("cs-CZ")} Kč`}
                  accent
                />
              )}
            </>
          ) : (
            <SumLine label={`Fotografie · ${dreamboxPhotos.length} ks`} value={`${printSubtotal.toLocaleString("cs-CZ")} Kč`} />
          )}
          {retouchTotal > 0 && (
            <SumLine
              label={`Retuš · ${RETOUCH_LABELS[globalRetouchLevel]} · ${dreamboxPhotos.length} ${dreamboxPhotos.length === 1 ? "fotka" : dreamboxPhotos.length < 5 ? "fotky" : "fotek"} × ${retouchUnitPrice} Kč`}
              value={`${retouchTotal.toLocaleString("cs-CZ")} Kč`}
            />
          )}
          {addons.map((a) => {
            const product = ADDON_PRODUCTS.find((p) => p.id === a.productId);
            return product ? <SumLine key={a.productId} label={product.name} value={`${a.price.toLocaleString("cs-CZ")} Kč`} /> : null;
          })}

          {/* Delivery */}
          <div style={{ margin: "14px 0" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Doručení</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { value: 1 as const, label: "Osobní vyzvednutí", price: "zdarma" },
                { value: 2 as const, label: "Poštou", price: "99 Kč" },
              ].map((opt) => (
                <button key={opt.value} onClick={() => useGalleryStore.setState({ delivery: opt.value })} style={{
                  all: "unset", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px",
                  border: delivery === opt.value ? "1.5px solid var(--fp-accent)" : "1px solid var(--fp-line)",
                  background: delivery === opt.value ? "var(--fp-accent-soft)" : "transparent",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: delivery === opt.value ? "var(--fp-accent)" : "var(--fp-ink)" }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>{opt.price}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--fp-line)", margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Celkem</span>
            <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 30 }}>{total.toLocaleString("cs-CZ")} Kč</span>
          </div>

          <button onClick={handleSubmit} disabled={submitting} style={{
            all: "unset", cursor: submitting ? "not-allowed" : "pointer",
            width: "100%", height: 48,
            background: "var(--fp-accent)", color: "#fff",
            fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, boxSizing: "border-box",
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
            Odeslat objednávku do ateliéru
          </button>
          {(() => {
            if (!activePkg) return null;
            const effectiveIncluded = activePkg.includedPhotos + usedCredits;
            const unused = effectiveIncluded - dreamboxPhotos.length;
            if (unused <= 0) return null;
            return (
              <div style={{
                marginTop: 12, padding: "10px 12px",
                background: "rgba(45,90,39,0.08)", border: "1px solid rgba(45,90,39,0.3)",
                fontSize: 12, color: "#2d5a27", lineHeight: 1.5,
              }}>
                🎟️ <strong>{unused} {unused === 1 ? "fotka" : unused < 5 ? "fotky" : "fotek"}</strong> z balíčku se přenese jako kredit do příští objednávky.
              </div>
            );
          })()}
          <div style={{ fontSize: 11, color: "var(--fp-ink-3)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            Po odeslání vám do 2–3 pracovních dnů potvrdíme zakázku e-mailem.
          </div>
        </div>
      </div>

      {/* Back button */}
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setStep(2)} style={{
          all: "unset", cursor: "pointer", height: 40, padding: "0 16px",
          border: "1px solid var(--fp-line)", fontSize: 13.5, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6, color: "var(--fp-ink)",
        }}>
          <ArrowLeft size={14} strokeWidth={1.8} />Zpět
        </button>
      </div>
    </div>
  );
}

const RETOUCH_LEVELS: RetouchLevel[] = ["none", "light", "medium", "heavy"];

const RETOUCH_DESCS: Record<RetouchLevel, string> = {
  none:   "Fotografie bez jakýchkoli úprav",
  light:  "Jemné vyrovnání světla a tónu",
  medium: "Standardní úpravy — doporučeno",
  heavy:  "Výrazné zpracování, stylizace",
};

function RetouchSlider({ value, onChange, photoCount }: { value: RetouchLevel; onChange: (v: RetouchLevel) => void; photoCount: number }) {
  const idx = RETOUCH_LEVELS.indexOf(value);
  const unitPrice = RETOUCH_PRICES[value];
  const total = unitPrice * photoCount;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
          Míra retuší
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fp-ink)" }}>
            {RETOUCH_LABELS[value]}
          </div>
          {unitPrice > 0 ? (
            <div style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>
              {unitPrice} Kč / fotka
              <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--fp-ink)" }}>
                = {total.toLocaleString("cs-CZ")} Kč
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--fp-ink-4)" }}>zdarma</div>
          )}
        </div>
      </div>

      <div style={{
        background: "var(--fp-surface)", border: "1px solid var(--fp-line)",
        padding: "20px 20px 18px",
      }}>
        {/* Slider track */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <style>{`
            .retouch-slider {
              -webkit-appearance: none;
              appearance: none;
              width: 100%;
              height: 3px;
              background: linear-gradient(
                to right,
                var(--fp-ink) 0%,
                var(--fp-ink) ${idx / 3 * 100}%,
                var(--fp-line) ${idx / 3 * 100}%,
                var(--fp-line) 100%
              );
              outline: none;
              cursor: pointer;
            }
            .retouch-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              width: 20px; height: 20px;
              background: var(--fp-ink);
              border-radius: 50%;
              border: 3px solid var(--fp-bg);
              box-shadow: 0 0 0 1.5px var(--fp-ink);
            }
            .retouch-slider::-moz-range-thumb {
              width: 20px; height: 20px;
              background: var(--fp-ink);
              border-radius: 50%;
              border: 3px solid var(--fp-bg);
              box-shadow: 0 0 0 1.5px var(--fp-ink);
            }
          `}</style>
          <input
            type="range"
            className="retouch-slider"
            min={0} max={3} step={1}
            value={idx}
            onChange={e => onChange(RETOUCH_LEVELS[parseInt(e.target.value)])}
          />
        </div>

        {/* Labels pod sliders */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {RETOUCH_LEVELS.map((lvl, i) => (
            <button
              key={lvl}
              onClick={() => onChange(lvl)}
              style={{
                all: "unset", cursor: "pointer",
                fontSize: 10.5, fontWeight: lvl === value ? 700 : 400,
                color: lvl === value ? "var(--fp-ink)" : "var(--fp-ink-3)",
                letterSpacing: "0.04em",
                textAlign: i === 0 ? "left" : i === 3 ? "right" : "center",
                flex: 1,
                transition: "color 0.15s",
              }}
            >
              {RETOUCH_LABELS[lvl]}
            </button>
          ))}
        </div>

        {/* Description + price breakdown */}
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "var(--fp-bg)", border: "1px solid var(--fp-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, color: "var(--fp-ink-3)", fontStyle: "italic" }}>
            {RETOUCH_DESCS[value]}
          </div>
          {unitPrice > 0 && (
            <div style={{
              fontSize: 11, color: "var(--fp-ink-3)",
              display: "flex", gap: 4, alignItems: "center", flexShrink: 0,
            }}>
              <span>{photoCount} fotek</span>
              <span style={{ opacity: 0.4 }}>×</span>
              <span>{unitPrice} Kč</span>
              <span style={{ opacity: 0.4 }}>=</span>
              <span style={{ fontWeight: 700, color: "var(--fp-ink)", fontSize: 13 }}>
                {total.toLocaleString("cs-CZ")} Kč
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SumLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
      <span style={{ color: accent ? "#c07030" : "var(--fp-ink-2)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: accent ? "#c07030" : undefined }}>{value}</span>
    </div>
  );
}
