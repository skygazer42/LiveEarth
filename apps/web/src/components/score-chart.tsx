import type { Locale, ScorePoint } from "@liveearth/domain/types";

export function ScoreChart({ points, locale }: { points: ScorePoint[]; locale: Locale }) {
  const width = 720;
  const height = 180;
  const horizontalPadding = 10;
  const verticalPadding = 16;
  const min = Math.min(...points.map((point) => point.score), 40);
  const max = Math.max(...points.map((point) => point.score), 100);
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = horizontalPadding + (index / Math.max(1, points.length - 1)) * (width - horizontalPadding * 2);
    const y = verticalPadding + ((max - point.score) / range) * (height - verticalPadding * 2);
    return { x, y, ...point };
  });
  const path = coordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <figure className="score-chart">
      <svg role="img" aria-labelledby="score-chart-title" viewBox={`0 0 ${width} ${height}`}>
        <title id="score-chart-title">
          {locale === "en" ? "Earth score over the last 24 hours" : "过去 24 小时地球评分"}
        </title>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            className="chart-grid"
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
          />
        ))}
        <path className="chart-area" d={`${path} L${width - horizontalPadding} ${height} L${horizontalPadding} ${height} Z`} />
        <path className="chart-line" d={path} />
        {coordinates.map((point, index) => (
          <circle
            key={point.at}
            className={index === coordinates.length - 1 ? "chart-point chart-point--latest" : "chart-point"}
            cx={point.x}
            cy={point.y}
            r={index === coordinates.length - 1 ? 4 : 2}
          />
        ))}
      </svg>
      <figcaption>
        <span>−24h</span>
        <strong>{points.at(-1)?.score.toFixed(1) ?? "—"}</strong>
        <span>{locale === "en" ? "now" : "现在"}</span>
      </figcaption>
    </figure>
  );
}
