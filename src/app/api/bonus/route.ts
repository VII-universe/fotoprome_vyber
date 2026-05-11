import { type NextRequest, NextResponse } from "next/server";
import { aspGet } from "@/lib/asp-client";
import { getSession, cookieJarFromSession } from "@/lib/session";

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

// GET /api/bonus?cx=JOBID
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cx = req.nextUrl.searchParams.get("cx");
  if (!cx) return NextResponse.json({ error: "Missing cx" }, { status: 400 });

  const jar = cookieJarFromSession(session);
  const { text } = await aspGet(`/svc/pages/web.asp?cx=${cx}`, jar);

  // Parse bonus galleries from the JS blob
  const galleries = parseBonusGalleries(text, cx);

  return NextResponse.json({ galleries });
}

function parseBonusGalleries(jsBlob: string, jobId: string): BonusGallery[] {
  const galleries: BonusGallery[] = [];

  // Bonus photos are usually in /shared/gallery/gif/ paths (retouched, no watermark)
  const photoRegex = /\/shared\/gallery\/gif\/([\w-]+)\/(\d+)_(\d+[\w]*?)\.jpg/gi;
  const photos: BonusPhoto[] = [];
  const seen = new Set<string>();

  let m;
  while ((m = photoRegex.exec(jsBlob)) !== null) {
    const [fullMatch, datePath, jid, num] = m;
    if (jid !== jobId) continue;
    const key = `${jid}_${num}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url = `/shared/gallery/gif/${datePath}/${jid}_${num}.jpg`;
    photos.push({
      id: key,
      num: parseInt(num),
      thumbUrl: `/shared/gallery/gif/thumbs/${datePath}/${jid}_${num}.jpg`,
      fullUrl: url,
      downloadUrl: `https://v1.fotoprome.cz${url}`,
    });
  }

  if (photos.length > 0) {
    galleries.push({
      id: jobId,
      title: `Hotové fotky – zakázka #${jobId}`,
      photos: photos.sort((a, b) => a.num - b.num),
    });
  }

  return galleries;
}
