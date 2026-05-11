import { type NextRequest, NextResponse } from "next/server";
import { aspGet, aspPost } from "@/lib/asp-client";
import { getSession, cookieJarFromSession, encodeSession, SESSION_COOKIE } from "@/lib/session";
import { parseDreambox } from "@/lib/asp-parsers";

// GET /api/dreambox?cx=JOBID  → list dreambox items
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cx = req.nextUrl.searchParams.get("cx");
  if (!cx) return NextResponse.json({ error: "Missing cx" }, { status: 400 });

  const jar = cookieJarFromSession(session);
  const { text } = await aspGet(`/svc/pages/dreambox.asp?cx=${cx}`, jar);
  const items = parseDreambox(text);

  return NextResponse.json({ items });
}

// POST /api/dreambox  → add/update/remove photo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jar = cookieJarFromSession(session);

  const payload: Record<string, string> = {
    act: body.act ?? "update",   // "update" | "drop"
    pid: String(body.pid ?? ""),
    did: String(body.did ?? "0"),
    zone: body.zone ?? "p",
    cx: String(body.cx ?? ""),
    uri: `/gallery/order.htm?cx=${body.cx}`,
    // color
    c1: String(body.colorA4 ?? 0),
    c2: String(body.colorA5 ?? 0),
    // bw
    b1: String(body.bwA4 ?? 0),
    b2: String(body.bwA5 ?? 0),
    // sepia
    s1: String(body.sepA4 ?? 0),
    s2: String(body.sepA5 ?? 0),
    // art color (l) and antique (o) — kept for compat, new UI won't expose them
    l1: "0", l2: "0",
    o1: "0", o2: "0",
    a1: "0", a2: "0",
  };

  const { cookies: newJar, status } = await aspPost("/svc/pages/dreambox.asp", payload, jar);

  const updatedSession = { ...session, ...newJar };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, encodeSession(updatedSession), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
