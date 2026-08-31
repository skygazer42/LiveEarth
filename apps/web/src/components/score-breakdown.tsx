import type { Locale, ScoreBreakdown as ScoreBreakdownType } from "@liveearth/domain/types";

const labels = {
  en: {
    visualImpact: "Visual impact",
    eventIntensity: "Event intensity",
    motion: "Motion",
    visibility: "Visibility",
    technicalQuality: "Technical quality",
    rarity: "Rarity",
  },
  zh: {
    visualImpact: "视觉冲击",
    eventIntensity: "事件强度",
    motion: "运动表现",
    visibility: "可见度",
    technicalQuality: "技术质量",
    rarity: "罕见性",
  },
} as const;

export function ScoreBreakdown({ scores, locale }: { scores: ScoreBreakdownType; locale: Locale }) {
  return (
    <dl className="score-breakdown">
      {(Object.entries(scores) as Array<[keyof ScoreBreakdownType, number]>).map(([key, value]) => (
        <div key={key}>
          <dt>{labels[locale][key]}</dt>
          <dd>
            <span className="score-track"><i style={{ transform: `scaleX(${value / 100})` }} /></span>
            <strong>{value}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}
