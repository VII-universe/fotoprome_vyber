"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Menu, X } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string;
}

const NAV = [
  { id: "dashboard", label: "Přehled", href: "/dashboard" },
  { id: "orders",    label: "Objednávky", href: "/dashboard" },
];

export function AppShell({ children, userName }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    toast.success("Odhlásili jste se");
    router.push("/login");
  }

  const activeId = pathname.startsWith("/dashboard") ? "dashboard" : "orders";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--fp-bg)" }}>
      {/* ── Top nav ── */}
      <header style={{
        height: 64,
        padding: "0 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--fp-surface)",
        borderBottom: "1px solid var(--fp-line)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        {/* Logo + nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 22,
              letterSpacing: 0.5,
              color: "var(--fp-ink)",
            }}>
              fotoprome<span style={{ color: "var(--fp-accent)", fontStyle: "italic" }}>.</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex" style={{ gap: 4 }}>
            {NAV.map((item) => (
              <Link key={item.id} href={item.href} style={{
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                color: activeId === item.id ? "var(--fp-ink)" : "var(--fp-ink-3)",
                background: activeId === item.id ? "var(--fp-bg)" : "transparent",
              }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: avatar */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: 14 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 12px 4px 4px",
            borderRadius: 999,
            border: "1px solid var(--fp-line)",
            cursor: "pointer",
          }} onClick={handleLogout} title="Odhlásit se">
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--fp-accent-soft)",
              color: "var(--fp-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              fontWeight: 600,
            }}>{initials}</div>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fp-ink)" }}>
              {userName ?? "Profil"}
            </span>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--fp-ink)",
            padding: 4,
          }}
          aria-label="Menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: "fixed",
          top: 64,
          left: 0,
          right: 0,
          background: "var(--fp-surface)",
          borderBottom: "1px solid var(--fp-line)",
          zIndex: 39,
          padding: "12px 22px 16px",
        }}>
          {NAV.map((item) => (
            <Link key={item.id} href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                padding: "11px 0",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--fp-ink)",
                textDecoration: "none",
                borderBottom: "1px solid var(--fp-line)",
              }}>
              {item.label}
            </Link>
          ))}
          <button onClick={handleLogout} style={{
            all: "unset",
            display: "block",
            padding: "11px 0",
            fontSize: 15,
            color: "var(--fp-ink-3)",
            cursor: "pointer",
            width: "100%",
            marginTop: 4,
          }}>
            Odhlásit se
          </button>
        </div>
      )}

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
