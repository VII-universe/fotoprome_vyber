import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";

const CREDITS_FILE = path.join(process.cwd(), "data", "credits.json");

interface CreditEntry {
  balance: number;
  history: {
    cx: string;
    packageName: string;
    delta: number;        // positive = earned, negative = used
    date: string;
    note: string;
  }[];
}

type CreditsStore = Record<string, CreditEntry>;

function readStore(): CreditsStore {
  try {
    const raw = fs.readFileSync(CREDITS_FILE, "utf8");
    return JSON.parse(raw) as CreditsStore;
  } catch {
    return {};
  }
}

function writeStore(store: CreditsStore) {
  fs.mkdirSync(path.dirname(CREDITS_FILE), { recursive: true });
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(store, null, 2), "utf8");
}

// GET /api/credits → { balance, history }
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = readStore();
  const entry = store[session.bid] ?? { balance: 0, history: [] };

  return NextResponse.json({ balance: entry.balance, history: entry.history });
}

// POST /api/credits
// Body: { action: "earn", cx, packageName, unused }   → add unused credits after order
//       { action: "use",  amount }                    → consume credits in new order
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action: "earn" | "use";
    cx?: string;
    packageName?: string;
    unused?: number;
    amount?: number;
  };

  const store = readStore();
  const key = session.bid;
  const entry: CreditEntry = store[key] ?? { balance: 0, history: [] };
  const now = new Date().toISOString().split("T")[0];

  if (body.action === "earn" && typeof body.unused === "number" && body.unused > 0) {
    entry.balance += body.unused;
    entry.history.unshift({
      cx: body.cx ?? "",
      packageName: body.packageName ?? "",
      delta: body.unused,
      date: now,
      note: `+${body.unused} fotek nevyčerpáno z balíčku ${body.packageName ?? ""}`,
    });
    store[key] = entry;
    writeStore(store);
    return NextResponse.json({ ok: true, balance: entry.balance });
  }

  if (body.action === "use" && typeof body.amount === "number" && body.amount > 0) {
    const toUse = Math.min(body.amount, entry.balance);
    if (toUse <= 0) return NextResponse.json({ ok: true, used: 0, balance: entry.balance });
    entry.balance -= toUse;
    entry.history.unshift({
      cx: "",
      packageName: "",
      delta: -toUse,
      date: now,
      note: `−${toUse} fotek využito v nové objednávce`,
    });
    store[key] = entry;
    writeStore(store);
    return NextResponse.json({ ok: true, used: toUse, balance: entry.balance });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
