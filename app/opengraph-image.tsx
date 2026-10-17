import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Strata: a bonding curve can go to zero. A Strata launch can't fall below its floor, and the floor only goes up.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { bg: "#000000", surface: "#121211", text: "#ECE7DD", muted: "#9C968A", rule: "#2B2925", accent: "#5FA595", deep: "#1C1B18" };

// Steps of the plinth, left to right: [x, top]. The floor runs along their tops.
const STEPS: [number, number][] = [
  [0, 300],
  [84, 250],
  [168, 190],
  [252, 120],
];
const W = 336;
const H = 380;

export default async function OpengraphImage() {
  const [display, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Archivo-Condensed-ExtraBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/JetBrainsMono-Medium.ttf")),
  ]);

  const floor = STEPS.map(([x, y], i) => `${i ? `V${y}` : `M${x} ${y}`} H${x + 84}`).join(" ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg, color: C.text, padding: "64px 72px", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="52" height="52" viewBox="0 0 32 32">
              <rect x="1" y="1" width="30" height="30" rx="5" fill={C.text} />
              <rect x="6" y="20" width="20" height="5" fill={C.bg} />
              <rect x="9" y="14" width="14" height="5" fill={C.bg} opacity=".72" />
              <rect x="12" y="8" width="8" height="5" fill={C.bg} opacity=".48" />
              <rect x="4" y="25.5" width="24" height="2" fill={C.accent} />
            </svg>
            <span style={{ fontSize: 46, letterSpacing: -1 }}>Strata</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 20, color: C.muted, marginLeft: 12, padding: "6px 12px", background: C.deep, borderRadius: 6 }}>
              tokens with a floor
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 84, lineHeight: 0.92, letterSpacing: -2, maxWidth: 640 }}>A bonding curve can go to zero.</span>
            <span style={{ fontSize: 38, color: C.muted, marginTop: 22, letterSpacing: -0.5 }}>A Strata launch can&rsquo;t fall below its floor.</span>
            <span style={{ display: "flex", alignSelf: "flex-start", fontSize: 38, marginTop: 14, padding: "6px 16px 10px", background: C.deep, borderRadius: 6, letterSpacing: -0.5 }}>
              And the floor only goes up.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {STEPS.map(([x, y]) => (
              <rect key={x} x={x} y={y} width="84" height={H - y} fill={C.surface} stroke={C.rule} strokeWidth="2" />
            ))}
            {STEPS.flatMap(([x, y]) =>
              Array.from({ length: Math.floor((H - y) / 22) }, (_, j) => (
                <path key={`${x}-${j}`} d={`M${x} ${y + 22 * (j + 1)}H${x + 84}`} stroke={C.rule} strokeWidth="1.5" />
              )),
            )}
            <path d="M4 288 C 40 230, 70 214, 96 240 S 150 150, 182 176 S 236 92, 268 108 S 316 40, 334 24" fill="none" stroke={C.text} strokeWidth="5" />
            <path d={floor} fill="none" stroke={C.accent} strokeWidth="8" />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: display, weight: 800, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
