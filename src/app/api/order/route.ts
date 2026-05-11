import { type NextRequest, NextResponse } from "next/server";
import { aspGet, aspPost } from "@/lib/asp-client";
import { getSession, cookieJarFromSession } from "@/lib/session";

// GET /api/order?cx=JOBID  → get order data (dreambox items + package info)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cx = req.nextUrl.searchParams.get("cx");
  if (!cx) return NextResponse.json({ error: "Missing cx" }, { status: 400 });

  const jar = cookieJarFromSession(session);
  const { text } = await aspGet(`/svc/pages/order.asp?cx=${cx}`, jar);

  // Return raw blob — the client-side configurator builds its own state
  return NextResponse.json({ raw: text });
}

// POST /api/order  → place order
// Body: { cx, delivery, paper, coupon, comments, globalComments }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jar = cookieJarFromSession(session);

  // Step 1: store per-photo comments via orderComments.asp
  if (body.globalComments) {
    await aspPost(
      `/svc/pages/orderComments.asp`,
      { act: "store", comments: body.globalComments, cx: body.cx },
      jar
    );
  }

  // Step 2: place order via ordered.asp (GET triggers the order)
  const qs = new URLSearchParams({
    order: "",
    cx: String(body.cx),
    delivery: String(body.delivery ?? "1"),
    paper: String(body.paper ?? "1"),
    coupon: body.coupon ?? "",
    comments: body.globalComments ?? "",
  }).toString();

  const { text, status } = await aspGet(`/svc/pages/ordered.asp?${qs}`, jar);

  // Try to extract order ID
  const orderIdMatch = text.match(/O(\d{4,})/);
  const orderId = orderIdMatch ? orderIdMatch[1] : null;

  return NextResponse.json({ ok: true, orderId });
}
