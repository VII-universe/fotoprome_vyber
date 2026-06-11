"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import type { UserProfile } from "@/lib/asp-parsers";

interface ProfileFormProps {
  initialProfile: Partial<UserProfile>;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [form, setForm] = useState<Partial<UserProfile>>(initialProfile);
  const [saving, setSaving] = useState(false);

  function update(field: keyof UserProfile, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Profil byl uložen");
    } catch {
      toast.error("Uložení se nezdařilo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontaktní údaje</CardTitle>
        <CardDescription>
          Tyto údaje budou použity pro doručení vašich fotografií.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Jméno</Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Jan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Příjmení</Label>
              <Input
                id="surname"
                value={form.surname ?? ""}
                onChange={(e) => update("surname", e.target.value)}
                placeholder="Novák"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">E-mail nelze změnit. Kontaktujte fotografa.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+420 777 123 456"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Ulice a č.p.</Label>
            <Input
              id="street"
              value={form.street ?? ""}
              onChange={(e) => update("street", e.target.value)}
              placeholder="Hlavní 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zip">PSČ</Label>
              <Input
                id="zip"
                value={form.zip ?? ""}
                onChange={(e) => update("zip", e.target.value)}
                placeholder="110 00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Město</Label>
              <Input
                id="city"
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Praha"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="terms"
              checked={form.termsAccepted ?? false}
              onChange={(e) => update("termsAccepted", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              Souhlasím se{" "}
              <a
                href="https://fotoprome.cz/balicky/podminky.htm"
                target="_blank"
                rel="noreferrer"
                className="underline text-primary"
              >
                zpracováním osobních údajů
              </a>{" "}
              a obchodními podmínkami studia Fotoprome.
            </label>
          </div>

          <button type="submit" disabled={saving} style={{
            all: "unset", cursor: saving ? "not-allowed" : "pointer",
            height: 40, padding: "0 20px", borderRadius: 0,
            background: "var(--fp-accent)", color: "#fff",
            fontSize: 13.5, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Ukládám…</> : <><Save className="w-4 h-4" />Uložit změny</>}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
