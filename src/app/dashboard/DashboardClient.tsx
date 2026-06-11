"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Camera, Package } from "lucide-react";
import type { Job, UserProfile } from "@/lib/asp-parsers";
import { vocative } from "@/lib/czech-vocative";
import { ProfileForm } from "./ProfileForm";
import { AppShell } from "@/components/AppShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ProductCarousel } from "@/components/ProductCarousel";

interface ProfileData {
  profile: Partial<UserProfile>;
  jobs: Job[];
}

const STATUS_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  "Výběr a objednání":       { label: "Čeká na váš výběr",  bg: "var(--fp-accent)",  fg: "#fff" },
  "Fotografie objednány":    { label: "Zpracovává se",       bg: "#eee9dc",           fg: "#7a6a4a" },
  "Objednáno":               { label: "Zpracovává se",       bg: "#eee9dc",           fg: "#7a6a4a" },
  "Hotovo":                  { label: "Hotovo",              bg: "#e3ebe2",           fg: "#4a6a4f" },
};
function statusStyle(raw: string) {
  return STATUS_MAP[raw] ?? { label: raw, bg: "#eee9dc", fg: "#7a6a4a" };
}

export function DashboardClient() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState(""); // empty on SSR, set on client → no hydration mismatch
  const isMobile = useIsMobile();

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => { if (d.error) toast.error(d.error); else setData(d); })
      .catch(() => toast.error("Nepodařilo se načíst profil"))
      .finally(() => setLoading(false));
  }, []);

  const profile = data?.profile ?? {};
  const jobs = data?.jobs ?? [];
  const displayName = [profile.name, profile.surname].filter(Boolean).join(" ");

  return (
    <AppShell userName={displayName || undefined}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <Loader2 size={32} style={{ color: "var(--fp-accent)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Page header */}
          <div style={{ padding: isMobile ? "24px 16px 16px" : "36px 48px 22px" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "var(--fp-ink-3)",
              textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8,
            }}>
              {dateStr}
            </div>
            <h1 style={{
              margin: 0,
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontWeight: 400, fontSize: 44, lineHeight: 1.0, letterSpacing: -0.6,
              color: "var(--fp-ink)",
            }}>
              {displayName ? <>Dobrý den, <em>{vocative(profile.name ?? "")}</em>.</> : "Dobrý den."}
            </h1>
          </div>

          <div style={{ padding: isMobile ? "0 16px" : "0 48px" }}>
            <Tabs defaultValue="jobs">
              <TabsList style={{
                background: "transparent", border: "none", padding: 0,
                marginBottom: 24, gap: 4,
              }}>
                {["jobs", "profile"].map((v) => (
                  <TabsTrigger key={v} value={v} style={{
                    fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                    padding: "8px 14px", borderRadius: 0,
                  }}>
                    {v === "jobs" ? "Moje galerie" : "Profil"}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ── Jobs ── */}
              <TabsContent value="jobs">
                {jobs.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "80px 0",
                    color: "var(--fp-ink-3)", fontSize: 15,
                  }}>
                    <Camera size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Zatím nemáte žádná focení.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                      <h2 style={{
                        margin: 0,
                        fontFamily: '"Instrument Serif", Georgia, serif',
                        fontWeight: 400, fontSize: 26, color: "var(--fp-ink)",
                      }}>Moje galerie</h2>
                      <span style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>{jobs.length} {jobs.length === 1 ? "album" : "alba"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginBottom: 48 }}>
                      {jobs.map((job, i) => (
                        <JobCard key={job.id} job={job} photoTone={[3, 7, 11, 4, 9][i % 5]} highlight={i === 0} />
                      ))}
                    </div>

                    {/* Product carousel */}
                    <div style={{ paddingBottom: 48 }}>
                      <ProductCarousel jobs={jobs} />
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Profile ── */}
              <TabsContent value="profile">
                <ProfileForm initialProfile={profile} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Crossfade slideshow — načte náhledové fotky z galerie a rotuje je
function GallerySlideshow({ jobId }: { jobId: string }) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetch(`/api/gallery?cx=${jobId}&act=all`)
      .then(r => r.json())
      .then(d => {
        // Vezmi každou 6. fotku (rozložení přes celou galerii), max 8
        const photos = d.photos ?? [];
        const step = Math.max(1, Math.floor(photos.length / 8));
        const selected: string[] = [];
        for (let i = 0; i < photos.length && selected.length < 8; i += step) {
          selected.push(`https://v1.fotoprome.cz${photos[i].fullUrl}`);
        }
        setThumbs(selected);
      })
      .catch(() => {});
  }, [jobId]);

  // Střídej fotky každé 3 sekundy
  useEffect(() => {
    if (thumbs.length < 2) return;
    const id = setInterval(() => setActive(a => (a + 1) % thumbs.length), 3000);
    return () => clearInterval(id);
  }, [thumbs.length]);

  if (thumbs.length === 0) return null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {thumbs.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: active === i ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        />
      ))}
    </div>
  );
}

function JobCard({ job, photoTone, highlight }: { job: Job; photoTone: number; highlight?: boolean }) {
  const st = statusStyle(job.status);
  const isDone = job.status === "Hotovo" || job.status === "Fotografie objednány";
  const dateStr = job.date
    ? new Date(job.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const TONES = ["#e8d5c4","#d4c5b5","#c9b8a4","#ddd0c0","#e0d0b8","#c8bca8","#d8c8b0","#e4d4bc","#cfc0ac","#dbc8b0","#e2d0ba","#d0bfa8"];
  const bg = TONES[photoTone % TONES.length];

  return (
    <div style={{
      overflow: "hidden",
      background: "var(--fp-surface)",
      border: highlight ? "1.5px solid var(--fp-ink)" : "1px solid var(--fp-line)",
      transition: "border-color 0.15s ease",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-accent)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = highlight ? "var(--fp-ink)" : "var(--fp-line)"; }}
    >
      {/* Clickable photo area */}
      <Link href={`/gallery/${job.id}`} style={{ textDecoration: "none", display: "block" }}>
        <div style={{ position: "relative", paddingBottom: "62%", background: bg }}>
          <StripedPlaceholder color={bg} />
          {/* Rotating thumbnails */}
          <GallerySlideshow jobId={job.id} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(28,26,23,0.62) 100%)",
          }} />
          <div style={{
            position: "absolute", top: 12, left: 12,
            padding: "5px 10px", borderRadius: 0,
            fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2,
            background: st.bg, color: st.fg,
          }}>● {st.label}</div>
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff" }}>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1.1 }}>
              {job.title || `Zakázka #${job.id}`}
            </div>
            <div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.85, display: "flex", gap: 8 }}>
              {dateStr && <span>{dateStr}</span>}
              {job.photoCount > 0 && <><span style={{ opacity: 0.6 }}>·</span><span>{job.photoCount} fotek</span></>}
            </div>
          </div>
        </div>
      </Link>

      {/* Quick action for done jobs */}
      {isDone && (
        <div style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--fp-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "var(--fp-ink-3)" }}>Vytvořit produkt z galerie</span>
          <Link
            href={`/products/${job.id}`}
            style={{
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 12px", borderRadius: 0,
              background: "var(--fp-bg)",
              border: "1px solid var(--fp-line)",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--fp-ink)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--fp-ink)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--fp-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-ink)"; }}
          >
            <Package size={12} strokeWidth={2} /> Objednat
          </Link>
        </div>
      )}
    </div>
  );
}

function StripedPlaceholder({ color }: { color: string }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: color,
      backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 8px)`,
    }} />
  );
}
