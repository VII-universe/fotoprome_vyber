// Zustand store for the gallery/ordering flow.
// Persisted in sessionStorage so browser navigation doesn't reset state.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GalleryPhoto } from "./asp-parsers";

export type ColorOption = "color" | "art_color" | "bw" | "sepia" | "antique" | "auto";
export type SizeOption = "S" | "M" | "L" | "retouch_only";
export type RetouchLevel = "none" | "light" | "medium" | "heavy";

// Advanced options
export type FrameOption = "" | "grunges" | "modern" | "photo" | "retro" | "romantica" | "simple";

export interface PhotoConfig {
  pid: string;
  did: string;
  zone: "p" | "l";
  prints: PrintLine[];
  retouchLevel: RetouchLevel;
  notes: string;
}

export interface PrintLine {
  color: ColorOption;
  size: SizeOption;
  qty: number;
  frame?: FrameOption;
  curves?: number;
  scratches?: number;
}

// Map new size labels → ASP field names
export const SIZE_LABELS: Record<SizeOption, string> = {
  S: "S (15 × 20 cm)",
  M: "M (20 × 27 cm)",
  L: "L (30 × 40 cm)",
  retouch_only: "Pouze retuš (bez tisku)",
};

export const COLOR_LABELS: Record<ColorOption, string> = {
  color:     "Barevná",
  art_color: "Art Color",
  bw:        "Černobílá",
  sepia:     "Sépia",
  antique:   "Antique",
  auto:      "Nechte to na nás",
};

// Photo URL variant suffix per color
export const COLOR_URL_SUFFIX: Record<ColorOption, string> = {
  color:     "",
  art_color: "_ls",
  bw:        "_bw",
  sepia:     "_sep",
  antique:   "_old",
  auto:      "a",   // ASP uses "a" suffix for auto/best
};

export const FRAME_LABELS: Record<FrameOption, string> = {
  "":          "Bez rámečku",
  grunges:     "Grunges",
  modern:      "Modern",
  photo:       "Photo",
  retro:       "Retro",
  romantica:   "Romantica",
  simple:      "Simple",
};

export const RETOUCH_LABELS: Record<RetouchLevel, string> = {
  none: "Bez retuše",
  light: "Málo retuše",
  medium: "Středně",
  heavy: "Hodně",
};

// Map size → ASP A4/A5 field suffixes
// S → a5 (15x20), M → a4 (20x27 equivalent), L → a3
export function sizeToAspField(size: SizeOption): "a5" | "a4" | "a3" {
  if (size === "S") return "a5";
  if (size === "M") return "a4";
  return "a3";
}

export function colorToAspPrefix(color: ColorOption): "c" | "b" | "s" | "l" | "o" {
  if (color === "bw")        return "b";
  if (color === "sepia")     return "s";
  if (color === "art_color") return "l";
  if (color === "antique")   return "o";
  return "c";
}

// Convert PrintLines to ASP dreambox payload fields
export function configToAspPayload(config: PhotoConfig): Record<string, string> {
  const fields: Record<string, string> = {
    c1: "0", c2: "0",
    b1: "0", b2: "0",
    s1: "0", s2: "0",
    l1: "0", l2: "0",
    o1: "0", o2: "0",
    a1: "0", a2: "0",
  };

  for (const line of config.prints) {
    if (line.qty <= 0) continue;
    const prefix = colorToAspPrefix(line.color);
    const aspSize = sizeToAspField(line.size);
    // a5 → suffix "2", a4 → suffix "1", a3 → "1" (best effort)
    const suffix = aspSize === "a5" ? "2" : "1";
    const key = `${prefix}${suffix}`;
    fields[key] = String((parseInt(fields[key] ?? "0") || 0) + line.qty);
  }

  return fields;
}

// ── Balíčky ───────────────────────────────────────────────────────────────

export interface Package {
  id: string;
  name: string;
  subtitle: string;
  tag?: string;
  includedPhotos: number;  // počet fotek zahrnutých v ceně
  basePrice: number;       // cena balíčku
  extraPhotoPrice: number; // cena za každou fotku nad limit
}

export const PACKAGES: Package[] = [
  {
    id: "mini",
    name: "Mini",
    subtitle: "Pro první vzpomínky",
    includedPhotos: 10,
    basePrice: 990,
    extraPhotoPrice: 60,
  },
  {
    id: "standard",
    name: "Standard",
    subtitle: "Nejoblíbenější volba",
    tag: "Doporučené",
    includedPhotos: 20,
    basePrice: 1690,
    extraPhotoPrice: 50,
  },
  {
    id: "premium",
    name: "Premium",
    subtitle: "Kompletní příběh",
    includedPhotos: 40,
    basePrice: 2990,
    extraPhotoPrice: 40,
  },
];

// ── Addon (Krok 3) ─────────────────────────────────────────────────────────

export type AddonProductId = "canvas" | "poster" | "photobook";

export interface AddonVariant {
  id: string;
  label: string;     // "40 × 60 cm"
  price: number;
}

export interface AddonItem {
  id: string;            // unique per item — allows multiple items of same productId
  productId: AddonProductId;
  photoIds: string[];    // 1 foto (canvas/poster), N fotek (photobook)
  variantId: string;
  qty: number;           // počet kusů (jen pro jednofotkové produkty)
  price: number;         // cena za 1 ks × qty
}

export const ADDON_PRODUCTS: {
  id: AddonProductId;
  name: string;
  description: string;
  tag?: string;
  priceFrom: number;
  multiPhoto: boolean;   // true = photobook (N fotek), false = plátno/plakát (1 fotka)
  variants: AddonVariant[];
}[] = [
  {
    id: "canvas",
    name: "Obraz na plátně",
    description: "Vaše fotografie na kvalitní lněné plátno s dřevěným rámem. Ideální dekorace i dárek.",
    tag: "Nejoblíbenější",
    priceFrom: 890,
    multiPhoto: false,
    variants: [
      { id: "c_30x40",  label: "30 × 40 cm",  price: 890 },
      { id: "c_40x60",  label: "40 × 60 cm",  price: 1290 },
      { id: "c_60x90",  label: "60 × 90 cm",  price: 1890 },
      { id: "c_80x120", label: "80 × 120 cm", price: 2490 },
    ],
  },
  {
    id: "poster",
    name: "Velkoformátový plakát",
    description: "Matný nebo lesklý tisk ve formátu až 60 × 90 cm. Ideální pro dětský pokoj.",
    priceFrom: 490,
    multiPhoto: false,
    variants: [
      { id: "p_30x45", label: "30 × 45 cm",  price: 490 },
      { id: "p_40x60", label: "40 × 60 cm",  price: 690 },
      { id: "p_60x90", label: "60 × 90 cm",  price: 990 },
    ],
  },
  {
    id: "photobook",
    name: "Fotoknížka",
    description: "Hardcover fotoknížka s vašimi nejkrásnějšími snímky. Uspořádáme ji za vás.",
    tag: "Novinka",
    priceFrom: 1490,
    multiPhoto: true,
    variants: [
      { id: "b_20x20_30", label: "20 × 20 cm · 30 stran", price: 1490 },
      { id: "b_20x20_60", label: "20 × 20 cm · 60 stran", price: 1890 },
      { id: "b_30x30_30", label: "30 × 30 cm · 30 stran", price: 1990 },
      { id: "b_30x30_60", label: "30 × 30 cm · 60 stran", price: 2490 },
    ],
  },
];

// ── Store ──────────────────────────────────────────────────────────────────

export type GalleryStep = 1 | 2 | 3 | 4;

export interface GalleryState {
  jobId: string;
  step: GalleryStep;
  photos: GalleryPhoto[];
  dreambox: Set<string>;
  configs: Record<string, PhotoConfig>;
  filterMode: "all" | "suggested" | "dreambox";
  addons: AddonItem[];
  globalNotes: string;
  coupon: string;
  delivery: 1 | 2;
  paper: 1 | 2;

  selectedPackageId: string | null;
  photoCredits: number;       // nevyčerpané fotky z předchozích objednávek
  usedCredits: number;        // kredity použité v aktuální objednávce

  // Actions
  setPhotos: (photos: GalleryPhoto[]) => void;
  setPackage: (id: string | null) => void;
  setPhotoCredits: (n: number) => void;
  setUsedCredits: (n: number) => void;
  toggleHeart: (pid: string, zone: "p" | "l", did?: string) => void;
  setDreamboxIds: (ids: Set<string>) => void;
  setConfig: (pid: string, config: Partial<PhotoConfig>) => void;
  setPrintLine: (pid: string, lineIdx: number, line: Partial<PrintLine>) => void;
  addPrintLine: (pid: string) => void;
  removePrintLine: (pid: string, lineIdx: number) => void;
  setStep: (step: GalleryStep) => void;
  setFilterMode: (mode: "all" | "suggested" | "dreambox") => void;
  setGlobalNotes: (notes: string) => void;
  setJobId: (id: string) => void;
  upsertAddon: (item: AddonItem) => void;
  removeAddon: (id: string) => void;        // remove by item.id
  reset: () => void;
}

const defaultState = {
  jobId: "",
  step: 1 as GalleryStep,
  photos: [] as GalleryPhoto[],
  dreambox: new Set<string>(),
  configs: {} as Record<string, PhotoConfig>,
  filterMode: "all" as const,
  addons: [] as AddonItem[],
  globalNotes: "",
  coupon: "",
  delivery: 1 as const,
  paper: 1 as const,
  selectedPackageId: null as string | null,
  photoCredits: 0,
  usedCredits: 0,
};

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setJobId: (jobId) => set({ jobId }),

      setPhotos: (photos) => set({ photos }),

      toggleHeart: (pid, zone, did) =>
        set((s) => {
          const next = new Set(s.dreambox);
          if (next.has(pid)) {
            next.delete(pid);
          } else {
            next.add(pid);
            // Pre-populate config if not exists
            if (!s.configs[pid]) {
              const photo = s.photos.find((p) => p.id === pid);
              s.configs[pid] = {
                pid,
                did: did ?? "0",
                zone: zone ?? photo?.zone ?? "p",
                prints: [{ color: "color", size: "S", qty: 1, frame: "", curves: 0, scratches: 0 }],
                retouchLevel: "none",
                notes: "",
              };
            }
          }
          return { dreambox: next };
        }),

      setDreamboxIds: (ids) => set({ dreambox: ids }),

      setConfig: (pid, partial) =>
        set((s) => ({
          configs: {
            ...s.configs,
            [pid]: { ...(s.configs[pid] ?? {}), ...partial } as PhotoConfig,
          },
        })),

      setPrintLine: (pid, lineIdx, partial) =>
        set((s) => {
          const cfg = s.configs[pid];
          if (!cfg) return s;
          const prints = [...cfg.prints];
          prints[lineIdx] = { ...prints[lineIdx], ...partial };
          return { configs: { ...s.configs, [pid]: { ...cfg, prints } } };
        }),

      addPrintLine: (pid) =>
        set((s) => {
          const cfg = s.configs[pid];
          if (!cfg) return s;
          return {
            configs: {
              ...s.configs,
              [pid]: {
                ...cfg,
                prints: [...cfg.prints, { color: "color", size: "S", qty: 1 }],
              },
            },
          };
        }),

      removePrintLine: (pid, lineIdx) =>
        set((s) => {
          const cfg = s.configs[pid];
          if (!cfg) return s;
          const prints = cfg.prints.filter((_, i) => i !== lineIdx);
          return { configs: { ...s.configs, [pid]: { ...cfg, prints } } };
        }),

      setStep: (step) => set({ step }),
      setFilterMode: (filterMode) => set({ filterMode }),
      setPackage: (id) => set({ selectedPackageId: id }),
      setPhotoCredits: (photoCredits) => set({ photoCredits }),
      setUsedCredits: (usedCredits) => set({ usedCredits }),
      setGlobalNotes: (globalNotes) => set({ globalNotes }),

      upsertAddon: (item) =>
        set((s) => ({
          addons: s.addons.some((a) => a.id === item.id)
            ? s.addons.map((a) => (a.id === item.id ? item : a))
            : [...s.addons, item],
        })),

      removeAddon: (id) =>
        set((s) => ({
          addons: s.addons.filter((a) => a.id !== id),
        })),

      reset: () => set({ ...defaultState, dreambox: new Set() }),
    }),
    {
      name: "fp-gallery",
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (_key, value) =>
          value instanceof Set ? { __type: "Set", values: [...value] } : value,
        reviver: (_key, value) => {
          if (
            value &&
            typeof value === "object" &&
            "__type" in value &&
            (value as Record<string, unknown>).__type === "Set"
          ) {
            return new Set((value as { __type: string; values: unknown[] }).values);
          }
          return value;
        },
      }),
    }
  )
);
