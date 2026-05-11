// Parsers for the legacy ASP JS-blob responses.
// All ASP endpoints return JS like:
//   var slotLeftStr='...html...';
//   function formStart(){ document.f1.name.value='Jakub'; ... }
// We regex-extract the meaningful HTML/values from these blobs.

export interface Job {
  id: string;
  title: string;
  date: string;
  status: string;
  packageName: string;
  photoCount: number;
}

export interface UserProfile {
  email: string;
  name: string;
  surname: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  termsAccepted: boolean;
}

export interface GalleryPhoto {
  id: string;       // image id from preview(ID)
  jobId: string;
  num: number;      // photo number (e.g. 8249)
  zone: "p" | "l";
  thumbUrl: string;
  fullUrl: string;
  isSuggested: boolean;
  dreamboxItemId?: string;
}

export interface DreamboxItem {
  did: string;
  pid: string;
  zone: "p" | "l";
  colorA4: number; colorA5: number;
  bwA4: number;    bwA5: number;
  sepA4: number;   sepA5: number;
  notes: string;
}

export interface PriceResult {
  total: string;
  breakdown: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Extract the value of a JS variable: var NAME='VALUE';
function extractJsVar(blob: string, name: string): string {
  const m = blob.match(new RegExp(`var ${name}='((?:[^'\\\\]|\\\\.)*)';`));
  if (!m) return "";
  return htmlEntities(m[1].replace(/\\'/g, "'"));
}

// ---------------------------------------------------------------------------
// Profile parser  — from update.asp formStart() function
// ---------------------------------------------------------------------------

export function parseProfile(jsBlob: string): Partial<UserProfile> {
  // formStart() sets: document.f1.FIELDNAME.value='VALUE';
  function getField(field: string): string {
    const m = jsBlob.match(new RegExp(`document\\.f1\\.${field}\\.value='([^']*)'`));
    return m ? htmlEntities(m[1]) : "";
  }

  const termsM = jsBlob.match(/document\.f1\.terms\.checked=(true|false)/);

  return {
    email:         getField("email"),
    name:          getField("name"),
    surname:       getField("surname"),
    phone:         getField("phone"),
    street:        getField("street"),
    zip:           getField("zip"),
    city:          getField("city"),
    termsAccepted: termsM?.[1] === "true",
  };
}

// ---------------------------------------------------------------------------
// Job list parser — from slotLeftStr in profile.asp / gallery.asp
// ---------------------------------------------------------------------------

export function parseJobList(jsBlob: string): Job[] {
  const left = extractJsVar(jsBlob, "slotLeftStr");
  const jobs: Job[] = [];

  // Find each job tab: id="tab19054">interní test</a>
  const tabRegex = /id="tab(\d+)"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = tabRegex.exec(left)) !== null) {
    const id = m[1];
    const title = htmlEntities(m[2].trim());

    // Find matching job div: <div id="job19054">...</div>
    const jobDivRegex = new RegExp(`<div id="job${id}"[^>]*>([\\s\\S]*?)<\\/div>\\s*<a`);
    const divM = left.match(jobDivRegex);
    const jobHtml = divM ? divM[1] : "";

    // Status
    const statusM = jobHtml.match(/<b>Stav:<\/b>\s*([^<]+)/);
    const status = statusM ? htmlEntities(statusM[1].trim()) : "";

    // Shoot date: <h4 class=shootingDate>29.4.2026</h4>
    const dateM = jobHtml.match(/shootingDate[^>]*>([^<]+)<\/h4>/);
    let date = "";
    if (dateM) {
      const parts = dateM[1].trim().split(".");
      if (parts.length === 3) {
        date = `${parts[2].trim()}-${parts[1].trim().padStart(2,"0")}-${parts[0].trim().padStart(2,"0")}`;
      }
    }

    // Photo count: Všechny fotografie (51)
    const countM = left.match(new RegExp(`cx=${id}[^>]*>[^(]*\\((\\d+)\\)`));
    const photoCount = countM ? parseInt(countM[1]) : 0;

    jobs.push({ id, title, date, status, packageName: "", photoCount });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Gallery parser — from slotRightStr in gallery.asp
// ---------------------------------------------------------------------------

export function parseGallery(jsBlob: string, jobId: string): GalleryPhoto[] {
  const right = extractJsVar(jsBlob, "slotRightStr");
  const photos: GalleryPhoto[] = [];

  // Each photo cell: <a href="javascript:preview(IMAGEID);">
  //   <img src="/shared/gif/suggest.png"|spacer.gif ...>  ← suggested indicator
  //   <img src="/shared/gallery/gif/thumbs/DATEPATH/JOBID_NUM.jpg" ...>
  // </a>
  // <div class=photoLabel>NUM</div>
  const cellRegex = /javascript:preview\((\d+)\);[^<]*<img[^>]+src="([^"]+)"[^>]*>[^<]*<img[^>]+src="([^"]+)"[^>]*>/g;
  let m;
  while ((m = cellRegex.exec(right)) !== null) {
    const [, imageId, indicatorSrc, thumbSrc] = m;

    // Only include photos belonging to this job
    if (!thumbSrc.includes(`/${jobId}_`)) continue;

    const isSuggested = indicatorSrc.includes("suggest.png");

    // Extract date path and photo number from thumb URL
    // e.g. /shared/gallery/gif/thumbs/2604-7/19054_8249.jpg
    const thumbMatch = thumbSrc.match(/\/thumbs\/([\w-]+)\/\d+_(\d+)\.jpg/);
    if (!thumbMatch) continue;
    const [, datePath, numStr] = thumbMatch;
    const num = parseInt(numStr);

    photos.push({
      id: imageId,
      jobId,
      num,
      zone: "p", // zone determined later via preview.asp if needed
      thumbUrl: `/shared/gallery/gif/thumbs/${datePath}/${jobId}_${numStr}.jpg`,
      fullUrl:  `/shared/gallery/gif/${datePath}/${jobId}_${numStr}.jpg`,
      isSuggested,
    });
  }

  return photos.sort((a, b) => a.num - b.num);
}

// ---------------------------------------------------------------------------
// Dreambox parser
// ---------------------------------------------------------------------------

export function parseDreambox(jsBlob: string): DreamboxItem[] {
  return []; // loaded fresh from dreambox2 per-item; kept for compat
}

// ---------------------------------------------------------------------------
// Price parser
// ---------------------------------------------------------------------------

export function parsePrice(jsBlob: string): PriceResult {
  const m = jsBlob.match(/slipRefresh\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/);
  if (m) {
    return { breakdown: stripTags(htmlEntities(m[1])), total: m[2] };
  }
  const priceM = jsBlob.match(/(\d[\d\s]*\s*Kč)/i);
  return { breakdown: "", total: priceM?.[1] ?? "" };
}

export interface JobDetail {
  id: string;
  photoCount: number;
  dreamboxCount: number;
  hasA4: boolean;
  hasA5: boolean;
}

export function parseJobDetail(jsBlob: string, jobId: string): Partial<JobDetail> {
  const right = extractJsVar(jsBlob, "slotRightStr");
  const photoCountM = right.match(/Všechny fotografie \((\d+)\)/);
  return {
    id: jobId,
    photoCount: photoCountM ? parseInt(photoCountM[1]) : 0,
    hasA4: right.toLowerCase().includes("a4"),
    hasA5: right.toLowerCase().includes("a5"),
  };
}
