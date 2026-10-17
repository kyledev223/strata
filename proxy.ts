import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional password gate for a private preview. Set PREVIEW_PASSWORD on the
 * host (any username works) and every page asks for it; leave it unset and
 * this does nothing.
 */
export function proxy(request: NextRequest) {
  const password = process.env.PREVIEW_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let supplied = "";
    try {
      supplied = atob(header.slice(6)).split(":").slice(1).join(":");
    } catch {}
    if (safeEqual(supplied, password)) return NextResponse.next();
  }

  return new NextResponse("This preview is password protected.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Strata preview", charset="UTF-8"' },
  });
}

/** Compare without exiting early on the first mismatch. */
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = {
  // Everything except build assets, the icon files, and robots.txt (crawlers should read "disallow", not a 401).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)"],
};
