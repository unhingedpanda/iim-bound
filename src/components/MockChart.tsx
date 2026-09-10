import { shortDate } from "@/lib/dates";

const W = 720;
const H = 260;
const PAD = { left: 4, right: 68, top: 22, bottom: 30 };

export type ChartPoint = {
  id: string;
  taken_on: string;
  series: string;
  percentile: number;
  estimated: boolean;
};

/** One series, so no legend: the heading names it. Reference lines are the targets. */
export default function MockChart({
  points,
  target,
  floor,
}: {
  points: ChartPoint[];
  target: number;
  floor: number;
}) {
  const lines = Array.from(new Set([floor, 90, 95, target]))
    .filter((v) => v > 0 && v <= 100)
    .sort((a, b) => a - b);

  // Scale to the data and the reference lines rather than a fixed 50-100, or
  // every real trace sits squashed against the top of the box.
  const values = [...points.map((p) => p.percentile), ...lines];
  const LO = values.length ? Math.max(0, Math.floor(Math.min(...values) - 3)) : 50;
  const HI = values.length ? Math.min(100, Math.ceil(Math.max(...values) + 1)) : 100;

  const x0 = PAD.left;
  const x1 = W - PAD.right;
  const y0 = PAD.top;
  const y1 = H - PAD.bottom;

  const yOf = (p: number) => y1 - ((Math.min(HI, Math.max(LO, p)) - LO) / (HI - LO)) * (y1 - y0);
  const xOf = (i: number) =>
    points.length < 2 ? (x0 + x1) / 2 : x0 + (i / (points.length - 1)) * (x1 - x0);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)} ${yOf(p.percentile).toFixed(1)}`)
    .join(" ");

  const last = points.length ? points[points.length - 1] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full min-w-[560px]"
      role="img"
      aria-label={
        last
          ? `Overall percentile across ${points.length} mocks, latest ${last.percentile}`
          : "No mocks logged yet"
      }
    >
      <title>Overall percentile over time</title>
      {lines.map((p) => (
        <g key={p}>
          <line
            x1={x0}
            y1={yOf(p)}
            x2={x1}
            y2={yOf(p)}
            stroke={p === target ? "var(--signal)" : "var(--line)"}
            strokeWidth={1}
            strokeDasharray={p === target ? undefined : "4 4"}
          />
          <text
            x={x1 + 8}
            y={yOf(p) + 4}
            fill={p === target ? "var(--signal)" : "var(--ink-3)"}
            fontSize="12"
          >
            {p}
            {p === target ? " aim" : p === floor ? " floor" : ""}
          </text>
        </g>
      ))}
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="var(--line)" strokeWidth={1} />
      <text x={x1 + 8} y={y1 + 4} fill="var(--ink-3)" fontSize="12">
        {LO}
      </text>

      {points.length === 0 ? (
        <text x={x0} y={(y0 + y1) / 2} fill="var(--ink-3)" fontSize="14">
          Log a mock and the trace starts here.
        </text>
      ) : null}

      {points.length > 1 ? (
        <path
          className="trace"
          d={path}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <circle
            key={p.id}
            cx={xOf(i)}
            cy={yOf(p.percentile)}
            r={isLast ? 6 : 4.5}
            fill={isLast ? "var(--signal)" : "var(--ink)"}
            stroke="var(--paper)"
            strokeWidth={2}
          >
            <title>
              {p.series} — {p.percentile.toFixed(2)}
              {p.estimated ? " (estimated)" : ""} on {shortDate(p.taken_on)}
            </title>
          </circle>
        );
      })}

      {last ? (
        <text
          x={xOf(points.length - 1) - 10}
          y={yOf(last.percentile) - 14}
          textAnchor="end"
          fill="var(--ink)"
          fontSize="14"
          fontWeight="700"
        >
          {last.percentile.toFixed(2)}
        </text>
      ) : null}

      {points.length ? (
        <>
          <text x={x0} y={H - 8} fill="var(--ink-3)" fontSize="12">
            {shortDate(points[0].taken_on)}
          </text>
          {points.length > 1 ? (
            <text x={x1} y={H - 8} textAnchor="end" fill="var(--ink-3)" fontSize="12">
              {shortDate(points[points.length - 1].taken_on)}
            </text>
          ) : null}
        </>
      ) : null}
    </svg>
  );
}
