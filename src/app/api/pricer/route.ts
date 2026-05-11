import { type NextRequest, NextResponse } from "next/server";
import { aspGet } from "@/lib/asp-client";
import { getSession, cookieJarFromSession } from "@/lib/session";
import { parsePrice } from "@/lib/asp-parsers";

// GET /api/pricer?cx=dreambox&ix=JOBID&type=a4|a5&qty=N&did=DID&coupon=X&sel=1
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const jar = cookieJarFromSession(session);

  const qs = searchParams.toString();
  const { text } = await aspGet(`/svc/pages/pricer.asp?${qs}`, jar);
  const price = parsePrice(text);

  return NextResponse.json(price);
}
