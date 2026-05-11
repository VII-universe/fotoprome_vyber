import { type NextRequest, NextResponse } from "next/server";
import { aspGet } from "@/lib/asp-client";
import { getSession, cookieJarFromSession } from "@/lib/session";
import { parseGallery } from "@/lib/asp-parsers";

// GET /api/gallery?cx=JOBID&act=all|suggest|dreambox
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const cx = searchParams.get("cx");
  const act = searchParams.get("act") ?? "all";

  if (!cx) return NextResponse.json({ error: "Missing cx" }, { status: 400 });

  const jar = cookieJarFromSession(session);

  // Fetch all pages — ASP paginates by 24, we loop until empty
  const allPhotos: ReturnType<typeof parseGallery> = [];
  let page = 1;
  const MAX_PAGES = 20;

  while (page <= MAX_PAGES) {
    const { text } = await aspGet(
      `/svc/pages/gallery.asp?act=${act}&cx=${cx}&page=${page}`,
      jar
    );

    const photos = parseGallery(text, cx);
    if (photos.length === 0) break;

    allPhotos.push(...photos);

    // If returned fewer than 24, we've hit the last page
    if (photos.length < 24) break;
    page++;
  }

  return NextResponse.json({ photos: allPhotos, total: allPhotos.length });
}
