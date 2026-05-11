"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, Images, ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "https://v1.fotoprome.cz";

interface BonusPhoto {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  downloadUrl: string;
  num: number;
}

interface BonusGallery {
  id: string;
  title: string;
  photos: BonusPhoto[];
}

interface Props { cx: string }

export function BonusClient({ cx }: Props) {
  const [galleries, setGalleries] = useState<BonusGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ galleryIdx: number; photoIdx: number } | null>(null);

  useEffect(() => {
    fetch(`/api/bonus?cx=${cx}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) toast.error(d.error);
        else setGalleries(d.galleries ?? []);
      })
      .catch(() => toast.error("Nepodařilo se načíst bonusweb"))
      .finally(() => setLoading(false));
  }, [cx]);

  function openLightbox(gi: number, pi: number) {
    setLightbox({ galleryIdx: gi, photoIdx: pi });
  }

  function closeLightbox() {
    setLightbox(null);
  }

  function navLightbox(dir: -1 | 1) {
    if (!lightbox) return;
    const gallery = galleries[lightbox.galleryIdx];
    const next = lightbox.photoIdx + dir;
    if (next >= 0 && next < gallery.photos.length) {
      setLightbox({ ...lightbox, photoIdx: next });
    }
  }

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navLightbox(-1);
      if (e.key === "ArrowRight") navLightbox(1);
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function downloadAll(gallery: BonusGallery) {
    toast.info(`Stahování ${gallery.photos.length} fotek…`, { duration: 3000 });
    for (const photo of gallery.photos) {
      try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(photo.downloadUrl)}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fotoprome_${photo.id}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 200));
      } catch {
        // continue
      }
    }
    toast.success("Stažení dokončeno");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPhoto =
    lightbox
      ? galleries[lightbox.galleryIdx]?.photos[lightbox.photoIdx]
      : null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <a href="/dashboard" className="hover:underline">Přehled</a>
        <span className="mx-2">/</span>
        <span>Bonusweb #{cx}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Hotové fotky</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zde jsou vaše retušované fotografie připravené ke stažení.
        </p>
      </div>

      {galleries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Images className="w-14 h-14 text-muted-foreground/40" />
          <div>
            <p className="font-medium">Bonusweb ještě není připraven</p>
            <p className="text-sm text-muted-foreground mt-1">
              Fotografie jsou stále v přípravě. Vrňte se prosím brzy.
            </p>
          </div>
        </div>
      ) : (
        galleries.map((gallery, gi) => (
          <div key={gallery.id} className="space-y-4">
            {gi > 0 && <Separator />}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">{gallery.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{gallery.photos.length} fotek</Badge>
                </div>
              </div>
              <Button
                onClick={() => downloadAll(gallery)}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Stáhnout vše (CD)
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {gallery.photos.map((photo, pi) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer photo-thumb"
                  onClick={() => openLightbox(gi, pi)}
                >
                  <img
                    src={`${BASE}${photo.thumbUrl}`}
                    alt={`Foto ${photo.num}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-1.5 right-1.5">
                    <a
                      href={`${BASE}${photo.fullUrl}`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                      title="Stáhnout"
                    >
                      <Download className="w-3.5 h-3.5 text-foreground" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Lightbox */}
      {lightbox && currentPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={closeLightbox}
          >
            <X className="w-5 h-5" />
          </button>

          <button
            className={cn(
              "absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors",
              lightbox.photoIdx === 0 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => { e.stopPropagation(); navLightbox(-1); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <img
            src={`${BASE}${currentPhoto.fullUrl}`}
            alt={`Foto ${currentPhoto.num}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className={cn(
              "absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors",
              lightbox.photoIdx === galleries[lightbox.galleryIdx].photos.length - 1 && "opacity-30 pointer-events-none"
            )}
            onClick={(e) => { e.stopPropagation(); navLightbox(1); }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 text-white/70 text-sm">
            {lightbox.photoIdx + 1} / {galleries[lightbox.galleryIdx].photos.length}
            <a
              href={`${BASE}${currentPhoto.fullUrl}`}
              download
              onClick={(e) => e.stopPropagation()}
              className="ml-4 underline hover:text-white"
            >
              Stáhnout
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
