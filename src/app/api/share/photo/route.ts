import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SHARES_FILE = path.join(process.cwd(), "data", "shares.json");

// GET /api/share/photo?token=xxx — proxy photo from ASP server (public)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const size = req.nextUrl.searchParams.get("size") ?? "full"; // "full" | "thumb"
  if (!token) return new NextResponse("Missing token", { status: 400 });

  let store: Record<string, { photoUrl: string; thumbUrl: string; expiresAt: string }>;
  try {
    store = JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const entry = store[token];
  if (!entry) return new NextResponse("Not found", { status: 404 });
  if (new Date(entry.expiresAt) < new Date()) return new NextResponse("Expired", { status: 410 });

  const relativeUrl = size === "thumb" ? entry.thumbUrl : entry.photoUrl;
  const imageUrl = `https://v1.fotoprome.cz${relativeUrl}`;

  try {
    const res = await fetch(imageUrl, {
      headers: { "Referer": "https://v1.fotoprome.cz" },
    });
    if (!res.ok) return new NextResponse("Image unavailable", { status: 502 });

    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Fetch error", { status: 502 });
  }
}
