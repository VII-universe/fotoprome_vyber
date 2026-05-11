import { type NextRequest, NextResponse } from "next/server";
import { aspGet } from "@/lib/asp-client";
import { getSession, cookieJarFromSession } from "@/lib/session";

// POST /api/notes  { ix: imageId, notes: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ix, notes } = await req.json();
  if (!ix) return NextResponse.json({ error: "Missing ix" }, { status: 400 });

  const jar = cookieJarFromSession(session);
  await aspGet(`/svc/svcNotesStore.asp?ix=${ix}&notes=${encodeURIComponent(notes ?? "")}`, jar);

  return NextResponse.json({ ok: true });
}
