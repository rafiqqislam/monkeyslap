import { formatDuration, type DaySummary } from "@monkeyslap/core";
import { useEffect, useRef, useState } from "react";

/**
 * Time on limited sites per day, as columns. One series, so no legend: the
 * section title names it. Hover (or focus) a day for its per-site breakdown.
 */

const H = 220;
const PAD = { top: 24, right: 8, bottom: 28, left: 44 };
const BAR = 24; // max column width
const BAR_COLOR = "#b8621b"; // validated: lightness, chroma and contrast on white

function niceStepMinutes(maxMin: number): number {
  for (const step of [1, 2, 5, 10, 15, 30, 60, 120, 240]) if (maxMin / step <= 4) return step;
  return 480;
}

function dayLabel(day: string, isToday: boolean): string {
  if (isToday) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short" });
}

function tickLabel(min: number): string {
  if (min === 0) return "0";
  return min % 60 === 0 ? `${min / 60} h` : `${min} min`;
}

export function WeekChart({ days }: { days: DaySummary[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Draw at the real width so text stays full size on narrow screens.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const maxMin = Math.max(1, ...days.map((d) => d.ms / 60_000));
  const step = niceStepMinutes(maxMin);
  const top = Math.ceil(maxMin / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / days.length;
  const barW = Math.min(BAR, band * 0.6);
  const y = (min: number) => PAD.top + plotH - (min / top) * plotH;
  const maxIdx = days.reduce((best, d, i) => (d.ms > days[best]!.ms ? i : best), 0);
  const lastIdx = days.length - 1;

  const hovered = hover === null ? null : days[hover];

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="text-xs font-semibold text-muted underline hover:text-ink"
        >
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 font-semibold">Day</th>
              <th className="py-1.5 font-semibold">Time</th>
              <th className="py-1.5 font-semibold">Slaps</th>
              <th className="py-1.5 font-semibold">Top site</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1.5">{dayLabel(d.day, i === lastIdx)}</td>
                <td className="py-1.5">{formatDuration(d.ms)}</td>
                <td className="py-1.5">{d.slaps}</td>
                <td className="py-1.5 text-muted">{d.sites[0]?.domain ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label="Time on limited sites per day, last 7 days">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#ece6dc" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#7a5a44">
                  {tickLabel(t)}
                </text>
              </g>
            ))}

            {days.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const min = d.ms / 60_000;
              const h = Math.max(0, y(0) - y(min));
              const r = Math.min(4, h / 2, barW / 2);
              const x0 = cx - barW / 2;
              const yTop = y(min);
              const showValue = d.ms > 0 && (i === maxIdx || i === lastIdx);
              return (
                <g key={d.day}>
                  {h > 0 && (
                    <path
                      // 4px rounded data-end, square at the baseline.
                      d={`M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`}
                      fill={BAR_COLOR}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                  {showValue && (
                    <text x={cx} y={yTop - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2b1a10">
                      {formatDuration(d.ms)}
                    </text>
                  )}
                  <text
                    x={cx}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={i === lastIdx ? 700 : 400}
                    fill={i === lastIdx ? "#2b1a10" : "#7a5a44"}
                  >
                    {dayLabel(d.day, i === lastIdx)}
                  </text>
                  {/* Hit target: the whole day band, bigger than the column. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${dayLabel(d.day, i === lastIdx)}: ${formatDuration(d.ms)}, ${d.slaps} slaps`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
          </svg>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-52 rounded-xl border border-line bg-white p-3 text-xs shadow-lg"
              style={{
                left: `clamp(0px, calc(${((PAD.left + band * hover + band / 2) / W) * 100}% - 104px), calc(100% - 208px))`,
              }}
            >
              <p className="font-bold">{dayLabel(hovered.day, hover === lastIdx)}</p>
              <p className="mt-0.5 text-muted">
                {formatDuration(hovered.ms)} · {hovered.slaps} {hovered.slaps === 1 ? "slap" : "slaps"}
              </p>
              {hovered.sites.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                  {hovered.sites.slice(0, 6).map((s) => (
                    <li key={s.domain} className="flex justify-between gap-2">
                      <span className="truncate">{s.domain}</span>
                      <span className="shrink-0 text-muted">{formatDuration(s.ms)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
