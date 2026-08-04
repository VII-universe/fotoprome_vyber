"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGalleryStore, SIZE_LABELS, COLOR_LABELS, ADDON_PRODUCTS, PACKAGES } from "@/lib/gallery-store";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, FrameIcon, Printer, BookOpen } from "lucide-react";
import type { GalleryPhoto } from "@/lib/asp-parsers";
import { useIsMobile } from "@/hooks/useIsMobile";

const BASE = "https://v1.fotoprome.cz";

const PRICE_MAP: Record<string, number> = { retouch_only: 80, S: 120, M: 220, L: 480 };

export function SummaryStep({ cx }: { cx: string }) {
  const router = useRouter();
  const { photos, dreambox, configs, addons, globalNotes, setGlobalNotes, delivery, setStep, reset, selectedPackageId } = useGalleryStore();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
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
      if (isExtra && l.size === "S") { printSubtotal += activePkg!.extraPhotoPrice * l.qty; return; }
      printSubtotal += price * l.qty;
    });
  });

  const addonsSubtotal = addons.reduce((s, a) => s + a.price, 0);
  const shipping = delivery === 2 ? 99 : 0;
  const subtotal = printSubtotal + addonsSubtotal;
  const total = subtotal + shipping;

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
      setDone(true);
      toast.success("Objednávka odeslána!");
    } catch {
      toast.error("Odeslání se nezdařilo. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
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
        <button onClick={() => { reset(); router.push("/dashboard"); }} style={{
          all: "unset", cursor: "pointer", height: 44, padding: "0 24px", borderRadius: 0,
          border: "1px solid var(--fp-line)", fontSize: 14, fontWeight: 500, color: "var(--fp-ink)",
        }}>
          Zpět na přehled
        </button>
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
                display: "grid", gridTemplateColumns: "200px 1fr 60px 80px",
                fontSize: 10.5, fontWeight: 600, color: "var(--fp-ink-3)",
                textTransform: "uppercase", letterSpacing: "0.14em",
              }}>
                <span>Fotografie</span><span>Formát</span><span>Počet</span><span style={{ textAlign: "right" }}>Cena</span>
              </div>
            )}

            {dreamboxPhotos.map((p) => {
              const c = configs[p.id];
              const prints = c?.prints?.filter(l => l.qty > 0) ?? [];

              if (isMobile) {
                /* ── Mobile: stacked card per photo ── */
                return (
                  <div key={p.id} style={{ borderBottom: "1px solid var(--fp-line)" }}>
                    {/* Photo header */}
                    <div style={{
                      display: "flex", gap: 12, alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: prints.length > 0 ? "1px solid var(--fp-line)" : "none",
                      background: "var(--fp-bg)",
                    }}>
                      <div style={{ width: 44, height: 44, flexShrink: 0, overflow: "hidden", background: "#e8d8c8" }}>
                        <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fp-ink-3)" }}>#{p.num}</div>
                        {c?.notes && <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginTop: 2, fontStyle: "italic" }}>„{c.notes}"</div>}
                        {prints.length === 0 && <div style={{ fontSize: 12, color: "var(--fp-ink-4)", marginTop: 2 }}>Nenakonfigurováno</div>}
                      </div>
                    </div>
                    {/* Print lines */}
                    {prints.map((line, li) => {
                      const price = (PRICE_MAP[line.size] ?? 0) * line.qty;
                      return (
                        <div key={li} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 16px",
                          borderBottom: li < prints.length - 1 ? "1px solid var(--fp-line)" : "none",
                          background: li % 2 === 0 ? "transparent" : "rgba(26,23,20,0.025)",
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{SIZE_LABELS[line.size]}</span>
                            <span style={{ fontSize: 12, color: "var(--fp-ink-3)", marginLeft: 8 }}>{COLOR_LABELS[line.color]}</span>
                            <span style={{ fontSize: 12, color: "var(--fp-ink-4)", marginLeft: 8 }}>×{line.qty}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{price.toLocaleString("cs-CZ")} Kč</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              /* ── Desktop: side-by-side ── */
              return (
                <div key={p.id} style={{ display: "flex", borderBottom: "1px solid var(--fp-line)" }}>
                  <div style={{
                    width: 200, flexShrink: 0, padding: "14px 16px",
                    display: "flex", gap: 12, alignItems: "flex-start",
                    borderRight: "1px solid var(--fp-line)",
                  }}>
                    <div style={{ width: 50, height: 50, flexShrink: 0, overflow: "hidden", background: "#e8d8c8" }}>
                      <img src={`${BASE}${p.thumbUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fp-ink-3)" }}>#{p.num}</div>
                      {prints.length === 0 && <div style={{ fontSize: 12, color: "var(--fp-ink-4)", marginTop: 3 }}>Nenakonfigurováno</div>}
                      {c?.notes && <div style={{ fontSize: 11, color: "var(--fp-ink-3)", marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>„{c.notes}"</div>}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {prints.length === 0 ? (
                      <div style={{ padding: "14px 16px", opacity: 0.4, fontSize: 13, color: "var(--fp-ink-3)" }}>—</div>
                    ) : prints.map((line, li) => {
                      const price = (PRICE_MAP[line.size] ?? 0) * line.qty;
                      return (
                        <div key={li} style={{
                          display: "grid", gridTemplateColumns: "1fr 60px 80px",
                          alignItems: "center", padding: "11px 16px",
                          borderBottom: li < prints.length - 1 ? "1px solid var(--fp-line)" : "none",
                          background: li % 2 === 0 ? "transparent" : "rgba(26,23,20,0.025)",
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{SIZE_LABELS[line.size]}</span>
                            <span style={{ fontSize: 12, color: "var(--fp-ink-3)", marginLeft: 8 }}>{COLOR_LABELS[line.color]}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>×{line.qty}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{price.toLocaleString("cs-CZ")} Kč</div>
                        </div>
                      );
                    })}
                  </div>
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
                    <div key={addon.productId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--fp-bg)", borderRadius: 0, border: "1px solid var(--fp-line)" }}>
                      {/* Photo collage */}
                      <div style={{ display: "flex", flexShrink: 0 }}>
                        {previewPhotos.map((p, i) => (
                          <div key={p.id} style={{ width: 36, height: 36, borderRadius: 0, overflow: "hidden", marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--fp-surface)" }}>
                            <img src={`${BASE}${p.fullUrl}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                        {addon.photoIds.length > 3 && (
                          <div style={{ width: 36, height: 36, borderRadius: 0, marginLeft: -8, background: "var(--fp-line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, border: "2px solid var(--fp-surface)" }}>
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
          borderRadius: 0, padding: 22, position: "sticky", top: 80,
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
                  padding: "10px 12px", borderRadius: 0,
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
            width: "100%", height: 48, borderRadius: 0,
            background: "var(--fp-accent)", color: "#fff",
            fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, boxSizing: "border-box",
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
            Odeslat objednávku do ateliéru
          </button>
          <div style={{ fontSize: 11, color: "var(--fp-ink-3)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            Po odeslání vám do 2–3 pracovních dnů potvrdíme zakázku e-mailem.
          </div>
        </div>
      </div>

      {/* Back button */}
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setStep(2)} style={{
          all: "unset", cursor: "pointer", height: 40, padding: "0 16px", borderRadius: 0,
          border: "1px solid var(--fp-line)", fontSize: 13.5, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6, color: "var(--fp-ink)",
        }}>
          <ArrowLeft size={14} strokeWidth={1.8} />Zpět
        </button>
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
