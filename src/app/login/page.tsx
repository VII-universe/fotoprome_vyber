"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Přihlášení se nezdařilo");
        return;
      }
      router.push("/dashboard");
    } catch {
      toast.error("Nepodařilo se spojit se serverem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      background: "var(--fp-bg)",
    }}>
      {/* Left — decorative panel (hidden on mobile) */}
      <div className="hidden lg:flex" style={{
        width: "45%",
        background: "var(--fp-surface)",
        borderRight: "1px solid var(--fp-line)",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Top: logo */}
        <div style={{
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontSize: 20, letterSpacing: 0.3, color: "var(--fp-ink)",
        }}>
          fotoprome<span style={{ color: "var(--fp-accent)", fontStyle: "italic" }}>.</span>
        </div>

        {/* Center: headline */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.2em", color: "var(--fp-ink-3)", marginBottom: 20,
          }}>
            Klientská sekce
          </div>
          <div style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 48, lineHeight: 1.05, color: "var(--fp-ink)", marginBottom: 20,
          }}>
            Vaše fotografie<br/>na jednom místě.
          </div>
          <div style={{
            width: 40, height: 1, background: "var(--fp-line)", marginBottom: 20,
          }} />
          <div style={{ fontSize: 13, color: "var(--fp-ink-3)", lineHeight: 1.7 }}>
            Vyberte a objednejte fotografie<br/>pohodlně z domova.
          </div>
        </div>

        {/* Bottom: version label */}
        <div style={{ fontSize: 10, color: "var(--fp-ink-4)", letterSpacing: "0.1em" }}>
          fotoprome.cz
        </div>
      </div>

      {/* Right — login form */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Logo */}
          <div style={{ marginBottom: 40 }}>
            <div style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 26, letterSpacing: 0.5, color: "var(--fp-ink)",
              marginBottom: 8,
            }}>
              fotoprome<span style={{ color: "var(--fp-accent)", fontStyle: "italic" }}>.</span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fp-ink-3)" }}>
              Přihlaste se do klientské sekce
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 600,
                color: "var(--fp-ink-3)", textTransform: "uppercase",
                letterSpacing: "0.14em", marginBottom: 8,
              }}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas@email.cz"
                required
                autoComplete="email"
                style={{
                  width: "100%", boxSizing: "border-box",
                  height: 44, padding: "0 14px",
                  borderRadius: 0,
                  border: "1px solid var(--fp-line)",
                  background: "var(--fp-surface)",
                  fontSize: 14, color: "var(--fp-ink)",
                  outline: "none",
                  transition: "border-color 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--fp-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--fp-line)")}
              />
            </div>

            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 600,
                color: "var(--fp-ink-3)", textTransform: "uppercase",
                letterSpacing: "0.14em", marginBottom: 8,
              }}>Heslo</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: "100%", boxSizing: "border-box",
                  height: 44, padding: "0 14px",
                  borderRadius: 0,
                  border: "1px solid var(--fp-line)",
                  background: "var(--fp-surface)",
                  fontSize: 14, color: "var(--fp-ink)",
                  outline: "none",
                  transition: "border-color 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--fp-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--fp-line)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                all: "unset", cursor: loading ? "not-allowed" : "pointer",
                height: 46, borderRadius: 0,
                background: loading ? "var(--fp-ink-3)" : "var(--fp-ink)",
                color: "var(--fp-bg)",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginTop: 8,
                transition: "background 0.15s",
              }}
            >
              {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />Přihlašuji…</> : "Přihlásit se"}
            </button>
          </form>

          <p style={{ marginTop: 28, fontSize: 12, color: "var(--fp-ink-4)", textAlign: "center" }}>
            Zapomněli jste heslo? Kontaktujte svého fotografa.
          </p>
        </div>
      </div>
    </main>
  );
}
