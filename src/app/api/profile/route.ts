import { NextRequest, NextResponse } from "next/server";
import { aspGet, aspPost } from "@/lib/asp-client";
import { getSession, cookieJarFromSession, encodeSession, SESSION_COOKIE } from "@/lib/session";
import { parseProfile, parseJobList } from "@/lib/asp-parsers";

// GET /api/profile  → returns { profile, jobs }
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = cookieJarFromSession(session);

  // profile.asp has job list in slotLeftStr; update.asp has formStart() with contact data
  const [profileRes, jobsRes] = await Promise.all([
    aspGet("/svc/pages/update.asp", jar),
    aspGet("/svc/pages/profile.asp", jar),
  ]);

  const profile = parseProfile(profileRes.text);
  const jobs = parseJobList(jobsRes.text);

  return NextResponse.json({ profile, jobs });
}

// PUT /api/profile  → saves profile changes
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jar = cookieJarFromSession(session);

  const { cookies: newJar } = await aspPost(
    "/svc/pages/update.asp?uri=/profile/profile.htm&back=/profile/profile.htm&base=",
    {
      act: "store",
      email: body.email ?? "",
      pass: body.pass ?? "",
      bonusweb: body.bonusweb ?? "",
      name: body.name ?? "",
      surname: body.surname ?? "",
      street: body.street ?? "",
      zip: body.zip ?? "",
      city: body.city ?? "",
      phone: body.phone ?? "",
      terms: body.termsAccepted ? "1" : "0",
    },
    jar
  );

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
