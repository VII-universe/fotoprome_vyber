"use client";

import { X, Package } from "lucide-react";
import { useGalleryStore, PACKAGES, COLOR_LABELS, SIZE_LABELS } from "@/lib/gallery-store";
import type { SizeOption } from "@/lib/gallery-store";

const SIZES: { id: SizeOption; price: number }[] = [
  { id: "retouch_only", price: 80 },
  { id: "S", price: 120 },
  { id: "M", price: 220 },
  { id: "L", price: 480 },
];
const S_PRICE = 120;

function sizePrice(size: SizeOption) {
  return SIZES.find(s => s.id === size)?.price ?? 0;
}

function photoLinePrice(
  size: SizeOption,
  isIncluded: boolean,
  isExtra: boolean,
  extraPhotoPrice: number,
): number {
  if (size === "retouch_only") return sizePrice(size);
  if (isIncluded && size === "S") return 0;
  if (isIncluded) return sizePrice(size) - S_PRICE;
  if (isExtra && size === "S") return extraPhotoPrice;
  return sizePrice(size);
}

interface VyberPanelProps {
  open: boolean;
  onClose: () => void;
}

export function VyberPanel({ open, onClose }: VyberPanelProps) {
  const { photos, dreambox, configs, selectedPackageId, usedCredits } = useGalleryStore();

  const dreamboxPhotos = photos.filter(p => dreambox.has(p.id));
  const pkg = selectedPackageId ? PACKAGES.find(p => p.id === selectedPackageId) : null;
  const effectiveIncluded = pkg ? pkg.includedPhotos + usedCredits : 0;

  // Precompute global line starts (each print line consumes one package slot)
  const lineStarts: number[] = [];
  let lineAcc = 0;
  for (const p of dreamboxPhotos) {
    lineStarts.push(lineAcc);
    lineAcc += configs[p.id]?.prints.length ?? 0;
  }
  const totalPrintLines = lineAcc;

  // total calculation
  let total = pkg ? pkg.basePrice : 0;
  let globalLi = 0;
  dreamboxPhotos.forEach((p) => {
    const c = configs[p.id];
    if (!c) return;
    for (const line of c.prints) {
      if (!line.qty) { globalLi++; continue; }
      const isIncluded = pkg ? globalLi < effectiveIncluded : false;
      const isExtra    = pkg ? globalLi >= effectiveIncluded : false;
      total += photoLinePrice(line.size, isIncluded, isExtra, pkg?.extraPhotoPrice ?? 0) * line.qty;
      globalLi++;
    }
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(480px, 100vw)",
        background: "var(--fp-bg)",
        borderLeft: "1px solid var(--fp-line)",
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: open ? "-12px 0 48px rgba(0,0,0,0.12)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--fp-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, color: "var(--fp-ink)" }}>
              Váš výběr
            </div>
            <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginTop: 2, letterSpacing: "0.04em" }}>
              {dreamboxPhotos.length === 0
                ? "Žádné fotky ve výběru"
                : `${dreamboxPhotos.length} ${dreamboxPhotos.length === 1 ? "fotka" : dreamboxPhotos.length < 5 ? "fotky" : "fotek"}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer", padding: 8,
              color: "var(--fp-ink-3)",
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Package chip */}
        {pkg && (
          <div style={{
            margin: "12px 24px 0",
            padding: "10px 14px",
            background: "var(--fp-ink)",
            color: "#fff",
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0,
          }}>
            <Package size={14} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>
                Balíček {pkg.name}
              </div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>
                {dreamboxPhotos.length}/{effectiveIncluded} fotek · {pkg.basePrice} Kč
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pkg.basePrice} Kč</div>
          </div>
        )}

        {/* Photo list */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 24px",
          display: "flex", flexDirection: "column", gap: 1,
        }}>
          {dreamboxPhotos.length === 0 && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: 200, color: "var(--fp-ink-3)", fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🖼️</div>
              Přidejte fotky ve výběru fotek
            </div>
          )}

          {dreamboxPhotos.map((photo, photoIdx) => {
            const c = configs[photo.id];
            const photoLineStart = lineStarts[photoIdx] ?? 0;
            // Photo badge: based on whether its first line is included
            const firstLineIncluded = pkg ? photoLineStart < effectiveIncluded : false;

            let photoTotal = 0;
            if (c) {
              c.prints.forEach((line, li) => {
                if (!line.qty) return;
                const gLi = photoLineStart + li;
                const inc = pkg ? gLi < effectiveIncluded : false;
                const ext = pkg ? gLi >= effectiveIncluded : false;
                photoTotal += photoLinePrice(line.size, inc, ext, pkg?.extraPhotoPrice ?? 0) * line.qty;
              });
            }

            return (
              <div key={photo.id} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "14px 0",
                borderBottom: "1px solid var(--fp-line)",
              }}>
                {/* Thumbnail */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/proxy?url=${encodeURIComponent(photo.thumbUrl)}`}
                    alt={`Foto #${photo.num}`}
                    style={{
                      width: 64, height: 64,
                      objectFit: "cover",
                      display: "block",
                      background: "var(--fp-surface)",
                    }}
                  />
                  {/* Photo number badge */}
                  <div style={{
                    position: "absolute", top: 0, left: 0,
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    padding: "2px 5px",
                    lineHeight: 1.4,
                  }}>
                    #{photo.num}
                  </div>
                  {/* Package status chip */}
                  {pkg && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      textAlign: "center",
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.06em",
                      padding: "2px 0",
                      background: firstLineIncluded ? "rgba(45,90,40,0.85)" : "rgba(180,100,0,0.85)",
                      color: "#fff",
                    }}>
                      {firstLineIncluded ? "V BAL." : "NAVÍC"}
                    </div>
                  )}
                </div>

                {/* Config details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fp-ink)", marginBottom: 6 }}>
                    Fotografie #{photo.num}
                  </div>

                  {!c || c.prints.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--fp-ink-3)" }}>Nekonfigurováno</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {c.prints.filter(l => l.qty > 0).map((line, li) => {
                        const gLi = photoLineStart + li;
                        const inc = pkg ? gLi < effectiveIncluded : false;
                        const ext = pkg ? gLi >= effectiveIncluded : false;
                        const linePrice = photoLinePrice(line.size, inc, ext, pkg?.extraPhotoPrice ?? 0);
                        const linePriceTotal = linePrice * line.qty;
                        const sizeLabel = line.size === "retouch_only"
                          ? "Pouze retuš"
                          : SIZE_LABELS[line.size].split(" ")[0]; // just "S", "M", "L"
                        const sizeDetail = line.size === "S" ? "15×20" : line.size === "M" ? "20×27" : line.size === "L" ? "30×42" : "";

                        return (
                          <div key={li} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 8,
                          }}>
                            <div style={{ fontSize: 11, color: "var(--fp-ink-2)", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                fontWeight: 700, fontFamily: "ui-monospace, monospace",
                                fontSize: 10, color: "var(--fp-ink)",
                                background: "var(--fp-surface)",
                                padding: "1px 6px",
                                border: "1px solid var(--fp-line)",
                              }}>
                                {line.qty}×
                              </span>
                              <span style={{ fontWeight: 600 }}>{sizeLabel}</span>
                              {sizeDetail && (
                                <span style={{ color: "var(--fp-ink-3)", fontSize: 10 }}>{sizeDetail}</span>
                              )}
                              <span style={{ color: "var(--fp-ink-3)" }}>·</span>
                              <span>{COLOR_LABELS[line.color]}</span>
                            </div>
                            <div style={{
                              fontSize: 11, fontWeight: 600, color: "var(--fp-ink)",
                              flexShrink: 0, fontFamily: "ui-monospace, monospace",
                            }}>
                              {linePrice === 0
                                ? <span style={{ color: "#2d8a4e", fontSize: 10 }}>zdarma</span>
                                : `${linePriceTotal} Kč`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Retouch note */}
                  {c?.retouchLevel && c.retouchLevel !== "none" && (
                    <div style={{
                      marginTop: 6, fontSize: 10, color: "var(--fp-ink-3)",
                      fontStyle: "italic",
                    }}>
                      Retuš: {c.retouchLevel === "light" ? "málo" : c.retouchLevel === "medium" ? "středně" : "hodně"}
                    </div>
                  )}
                  {c?.notes && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--fp-ink-3)", fontStyle: "italic" }}>
                      Poznámka: {c.notes}
                    </div>
                  )}
                </div>

                {/* Photo subtotal */}
                <div style={{
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  color: photoTotal === 0 && pkg ? "#2d8a4e" : "var(--fp-ink)",
                  fontFamily: "ui-monospace, monospace",
                  paddingTop: 2,
                }}>
                  {photoTotal === 0 && pkg ? "zdarma" : `${photoTotal} Kč`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer total */}
        {dreamboxPhotos.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--fp-line)",
            padding: "16px 24px",
            flexShrink: 0,
            background: "var(--fp-bg)",
          }}>
            {pkg && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 11, color: "var(--fp-ink-3)", marginBottom: 8,
              }}>
                <span>Balíček {pkg.name}</span>
                <span>{pkg.basePrice} Kč</span>
              </div>
            )}
            {pkg && (() => {
              const extraCount = Math.max(0, totalPrintLines - effectiveIncluded);
              if (extraCount === 0) return null;
              const extraTotal = extraCount * pkg.extraPhotoPrice;
              return (
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "#b05000", marginBottom: 8,
                }}>
                  <span>{extraCount} fotek navíc</span>
                  <span>+{extraTotal} Kč</span>
                </div>
              );
            })()}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: pkg ? 8 : 0,
              borderTop: pkg ? "1px solid var(--fp-line)" : "none",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-ink)" }}>Celkem</span>
              <span style={{
                fontSize: 22, fontWeight: 700, color: "var(--fp-ink)",
                fontFamily: '"Instrument Serif", Georgia, serif',
              }}>
                {total.toLocaleString("cs-CZ")} Kč
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
