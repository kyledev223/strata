import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// The homepage and projects list are cached for 60 s, along with the RPC reads
// behind them. After a transaction confirms, the client calls this so the next
// visit shows it. It only marks pages stale; the throttle stops it from being
// used to turn every page view into fresh RPC reads.
const MIN_INTERVAL_MS = 2_000;
let last = 0;

export async function POST() {
  const now = Date.now();
  if (now - last < MIN_INTERVAL_MS) return NextResponse.json({ revalidated: false });
  last = now;
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json({ revalidated: true });
}
