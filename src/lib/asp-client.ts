// Low-level HTTP client that forwards cookies to the legacy ASP backend.
// All methods return raw text — parsing is done by the callers.

const BASE = "https://v1.fotoprome.cz";

export type CookieJar = Record<string, string>;

function buildCookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function extractSetCookies(headers: Headers, jar: CookieJar): CookieJar {
  const updated = { ...jar };
  const raw = headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) updated[name] = value;
  }
  return updated;
}

export interface AspResponse {
  status: number;
  text: string;
  cookies: CookieJar;
}

export async function aspGet(
  path: string,
  jar: CookieJar,
  init?: RequestInit
): Promise<AspResponse> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Cookie: buildCookieHeader(jar),
      "User-Agent": "Mozilla/5.0 (compatible; FotopromeApp/1.0)",
      Accept: "text/javascript,text/html,*/*",
      ...(init?.headers as Record<string, string> | undefined),
    },
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  const cookies = extractSetCookies(res.headers, jar);
  return { status: res.status, text, cookies };
}

export async function aspPost(
  path: string,
  body: Record<string, string>,
  jar: CookieJar
): Promise<AspResponse> {
  const url = `${BASE}${path}`;
  const encoded = new URLSearchParams(body).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: buildCookieHeader(jar),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; FotopromeApp/1.0)",
      Accept: "text/javascript,text/html,*/*",
    },
    body: encoded,
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  const cookies = extractSetCookies(res.headers, jar);
  return { status: res.status, text, cookies };
}
