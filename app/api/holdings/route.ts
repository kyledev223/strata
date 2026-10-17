import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";

/** A wallet's Strata holdings, read through the data source. */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) return NextResponse.json({ error: "Bad owner address." }, { status: 400 });
  try {
    const holdings = await getDataSource().getHoldings(owner);
    return NextResponse.json({ holdings }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not read holdings from the RPC." }, { status: 502 });
  }
}
