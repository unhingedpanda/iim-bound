import { MARK_BARS, MARK_RULE, MARK_VIEWBOX } from "@/lib/mark";

/**
 * The mark, drawn from the shared geometry and coloured with the app's own
 * tokens — so it follows the theme the way every other surface does, while the
 * favicon keeps the fixed palette it needs.
 *
 * Decorative by default: it always sits beside the wordmark, so a screen reader
 * announcing "IIM Bound" twice would be noise. Pass a `title` when it stands
 * alone.
 */
export default function Mark({
  size = 26,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
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
      <rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={3} fill="var(--ink)" />
      {MARK_BARS.map((bar) => (
        <rect
          key={`${bar.x}-${bar.y}`}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          fill={bar.tone === "signal" ? "var(--signal)" : "var(--paper)"}
        />
      ))}
      <path d={MARK_RULE.d} fill={MARK_RULE.tone === "signal" ? "var(--signal)" : "var(--paper)"} />
    </svg>
  );
}
