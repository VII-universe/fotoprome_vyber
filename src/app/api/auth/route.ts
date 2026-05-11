import { NextRequest, NextResponse } from "next/server";
import { aspPost, aspGet } from "@/lib/asp-client";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/session";

// POST /api/auth  { email, password }  → sets fp_session cookie
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const { cookies: jar, status } = await aspPost(
    "/svc/pages/broker.asp?uri=/profile/profile.htm&back=/profile/profile.htm&base=",
    { act: "logon", email, pass: password },
    {}
  );

  const hasSession = jar.sid2 && jar.sid2 !== "";
  if (!hasSession) {
    return NextResponse.json({ error: "Nesprávné přihlašovací údaje" }, { status: 401 });
  }

  const session: Session = {
    perm: jar.perm ?? "",
    sid2: jar.sid2,
    bid: jar.bid ?? "",
    seed: jar.seed ?? "",
    term: jar.term,
  };

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

// DELETE /api/auth  → clears session
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
