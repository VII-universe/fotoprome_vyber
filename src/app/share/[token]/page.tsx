import { notFound } from "next/navigation";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";

const SHARES_FILE = path.join(process.cwd(), "data", "shares.json");

interface ShareData {
  photoUrl: string;
  thumbUrl: string;
  photoNum: number;
  cx: string;
  expiresAt: string;
}

function readShare(token: string): ShareData | null {
  try {
    const store = JSON.parse(fs.readFileSync(SHARES_FILE, "utf8")) as Record<string, ShareData & { expiresAt: string }>;
    const entry = store[token];
    if (!entry) return null;
    if (new Date(entry.expiresAt) < new Date()) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const share = readShare(token);
  if (!share) return { title: "Fotografie – Fotoprome" };
  return {
    title: `Fotografie #${share.photoNum} – Fotoprome`,
    description: "Náhled fotografie z Fotoprome ateliéru",
    openGraph: {
      images: [`/api/share/photo?token=${token}&size=thumb`],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = readShare(token);
  if (!share) notFound();

  const photoSrc = `/api/share/photo?token=${token}&size=full`;
  const thumbSrc = `/api/share/photo?token=${token}&size=thumb`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1c1a17",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(28,26,23,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 20, color: "#fff", letterSpacing: "-0.01em",
          }}>
            Fotoprome
          </span>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14 }}>·</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "ui-monospace, monospace" }}>
            Náhled fotografie #{share.photoNum}
          </span>
        </div>
        <a
          href="https://fotoprome.cz"
          style={{
            fontSize: 11, color: "rgba(255,255,255,0.4)",
            textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
          }}
        >
          fotoprome.cz
        </a>
      </div>

      {/* Photo */}
      <div style={{ marginTop: 64, width: "100%", maxWidth: 900, position: "relative" }}>
        {/* Number badge */}
        <div style={{
          position: "absolute", top: 0, left: 0, zIndex: 2,
          background: "rgba(28,26,23,0.9)",
          color: "#fff", padding: "6px 14px",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.06em",
        }}>
          #{share.photoNum}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc}
          alt={`Fotografie #${share.photoNum}`}
          style={{
            display: "block",
            width: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
            background: "#2a2520",
          }}
        />
      </div>

      {/* Footer strip */}
      <div style={{
        marginTop: 24, width: "100%", maxWidth: 900,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Fotoprome ateliér · Toto je soukromý náhled fotografie
        </div>
        <a
          href={photoSrc}
          download={`fotoprome-${share.photoNum}.jpg`}
          style={{
            fontSize: 12, color: "rgba(255,255,255,0.55)",
            textDecoration: "none", padding: "7px 16px",
            border: "1px solid rgba(255,255,255,0.15)",
            letterSpacing: "0.04em",
            transition: "all 0.15s",
          }}
        >
          Stáhnout náhled
        </a>
      </div>
    </div>
  );
}
