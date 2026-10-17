/**
 * Upload a token picture and its metadata JSON to IPFS through Pinata.
 * Configure with PINATA_JWT (and optionally PINATA_GATEWAY). Without it the
 * route answers 501 and launches go out without a picture.
 */
import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/limits";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const gateway = () => (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "");

export function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.PINATA_JWT) });
}

async function pin(jwt: string, file: Blob, name: string): Promise<string> {
  const form = new FormData();
  form.set("file", file, name);
  form.set("network", "public");
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed (${res.status})`);
  const json = (await res.json()) as { data?: { cid?: string } };
  const cid = json.data?.cid;
  if (!cid) throw new Error("Pinata returned no CID");
  return `${gateway()}/ipfs/${cid}`;
}

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ error: "Uploads are not configured." }, { status: 501 });

  const form = await req.formData();
  const name = String(form.get("name") ?? "").slice(0, LIMITS.token.nameMaxChars);
  const symbol = String(form.get("symbol") ?? "").slice(0, LIMITS.token.tickerMaxChars);
  const description = String(form.get("description") ?? "").slice(0, LIMITS.token.descriptionMaxChars);
  const image = form.get("image");

  try {
    let imageUrl: string | undefined;
    if (image instanceof File && image.size > 0) {
      if (!IMAGE_TYPES.has(image.type)) return NextResponse.json({ error: "Use PNG, JPG, GIF or WebP." }, { status: 400 });
      if (image.size > LIMITS.token.imageMaxBytes) return NextResponse.json({ error: "Picture is too large." }, { status: 400 });
      imageUrl = await pin(jwt, image, image.name || "image");
    }
    const metadata = { name, symbol, description, ...(imageUrl ? { image: imageUrl, properties: { files: [{ uri: imageUrl, type: (image as File).type }] } } : {}) };
    const uri = await pin(jwt, new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
    if (uri.length > 200) return NextResponse.json({ error: "Metadata URL is too long; use a shorter PINATA_GATEWAY." }, { status: 500 });
    return NextResponse.json({ uri, image: imageUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 502 });
  }
}
