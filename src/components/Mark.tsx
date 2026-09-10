import { MARK_BARS, MARK_RULE, MARK_VIEWBOX, type MarkVariant } from "@/lib/mark";

/**
 * The mark, drawn from the shared geometry.
 *
 * `tile` is the app icon: a fixed dark tile with a blue step, matching the
 * favicon so the logo is the same object in the tab and in the page.
 *
 * `mark` is the masthead logo: the same shapes with no tile, the bars in the
 * current text colour. It reads on either background without inverting, which
 * the tiled version cannot do — themed with CSS variables it turns into a cream
 * block with black bars in dark mode, a different logo from the one in the tab.
 *
 * Decorative by default: it always sits beside the wordmark, so announcing
 * "IIM Bound" twice would be noise. Pass `title` when it stands alone.
 */
export default function Mark({
  size = 24,
  variant = "mark",
  className = "",
  title,
}: {
  size?: number;
  variant?: MarkVariant;
  className?: string;
  title?: string;
}) {
  const fill = (tone: "paper" | "signal") => {
    if (tone === "signal") return "var(--signal)";
    return variant === "tile" ? "var(--paper)" : "currentColor";
  };

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {variant === "tile" ? (
        <rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={3} fill="var(--ink)" />
      ) : null}
      {MARK_BARS.map((bar) => (
        <rect
          key={`${bar.x}-${bar.y}`}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          fill={fill(bar.tone)}
        />
      ))}
      <path d={MARK_RULE.d} fill={fill(MARK_RULE.tone)} />
    </svg>
  );
}
