// Session management — stores ASP cookies server-side in an encrypted Next.js cookie.

import { cookies } from "next/headers";

export interface Session {
  perm: string;
  sid2: string;
  bid: string;
  seed: string;
  term?: string;
  session?: string;
}

const COOKIE_NAME = "fp_session";

export function cookieJarFromSession(s: Session): Record<string, string> {
  const jar: Record<string, string> = {
    perm: s.perm,
    sid2: s.sid2,
    bid: s.bid,
    seed: s.seed,
  };
  if (s.term) jar.term = s.term;
  if (s.session) jar.session = s.session;
  return jar;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s)).toString("base64");
}

export const SESSION_COOKIE = COOKIE_NAME;
