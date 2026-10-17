/** Generated token picture: stone strata tinted by the token's hue, with its ticker. */
export function TokenGlyph({
  ticker,
  hue,
  size = 72,
  image,
  className,
}: {
  ticker: string;
  hue: number;
  size?: number;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied blob/IPFS image
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className={`block flex-none rounded-[4px] border border-rule object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const bands = [0, 1, 2, 3, 4];
  const label = ticker.slice(0, 4).toUpperCase() || "?";
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-hidden="true"
      className={`block flex-none rounded-[4px] border border-rule ${className ?? ""}`}
    >
      <rect width="72" height="72" fill={`hsl(${hue} 22% 52%)`} />
      {bands.map((i) => (
        <rect
          key={i}
          x="0"
          y={36 + i * 8}
          width="72"
          height="8"
          fill={`hsl(${(hue + i * 9) % 360} ${18 + i * 3}% ${44 - i * 5}%)`}
        />
      ))}
      <path d="M0 36H72" stroke="hsl(0 0% 100% / .5)" strokeWidth="1.5" />
      <text
        x="36"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize={label.length > 3 ? 17 : 21}
        fill="hsl(40 30% 96%)"
        style={{ fontStretch: "80%" }}
      >
        {label}
      </text>
    </svg>
  );
}
