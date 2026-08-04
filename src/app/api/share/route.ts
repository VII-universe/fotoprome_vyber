import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const SHARES_FILE = path.join(process.cwd(), "data", "shares.json");
const SHARE_TTL_DAYS = 90;

interface ShareEntry {
  token: string;
  photoUrl: string;   // full URL on v1.fotoprome.cz
  thumbUrl: string;
  photoNum: number;
  cx: string;
  createdAt: string;
  expiresAt: string;
}

type SharesStore = Record<string, ShareEntry>;

function readStore(): SharesStore {
  try {
    return JSON.parse(fs.readFileSync(SHARES_FILE, "utf8")) as SharesStore;
  } catch {
    return {};
  }
}

function writeStore(store: SharesStore) {
  fs.mkdirSync(path.dirname(SHARES_FILE), { recursive: true });
  fs.writeFileSync(SHARES_FILE, JSON.stringify(store, null, 2), "utf8");
}

// POST /api/share — create share token (requires auth)
// Body: { photoUrl, thumbUrl, photoNum, cx }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    photoUrl: string;
    thumbUrl: string;
    photoNum: number;
    cx: string;
  };

  if (!body.photoUrl) return NextResponse.json({ error: "Missing photoUrl" }, { status: 400 });

  const token = crypto.randomBytes(16).toString("hex");
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + SHARE_TTL_DAYS);

  const entry: ShareEntry = {
    token,
    photoUrl: body.photoUrl,
    thumbUrl: body.thumbUrl,
    photoNum: body.photoNum,
    cx: body.cx,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const store = readStore();
  store[token] = entry;
  writeStore(store);

  return NextResponse.json({ token });
}

// GET /api/share?token=xxx — read share (public, no auth)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const store = readStore();
  const entry = store[token];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (new Date(entry.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  return NextResponse.json({
    photoUrl: entry.photoUrl,
    thumbUrl: entry.thumbUrl,
    photoNum: entry.photoNum,
    cx: entry.cx,
    expiresAt: entry.expiresAt,
  });
}
