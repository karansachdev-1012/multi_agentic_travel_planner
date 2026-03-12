import s from "../styles/SeasonalPanel.module.css";

const SEASON_EMOJI = {
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  winter: "❄️",
};

const TOURISM_COLORS = {
  peak: { bg: "rgba(232,112,112,.12)", border: "rgba(232,112,112,.3)", color: "#e87070" },
  shoulder: { bg: "rgba(212,168,67,.12)", border: "rgba(212,168,67,.3)", color: "#d4a843" },
  "off-peak": { bg: "rgba(76,175,142,.12)", border: "rgba(76,175,142,.3)", color: "#4caf8e" },
};

export function SeasonalPanel({ seasonal }) {
  if (!seasonal || seasonal.error) return null;

  const tc = TOURISM_COLORS[seasonal.tourism_level] || TOURISM_COLORS.shoulder;

  return (
    <div className={s.card}>
      <div className={s.label}>Seasonal Intelligence</div>
      <div className={s.header}>
        <span className={s.seasonEmoji}>{SEASON_EMOJI[seasonal.season] || "🌍"}</span>
        <div className={s.headerInfo}>
          <div className={s.seasonName}>{seasonal.season}</div>
          <div className={s.monthTourism}>{seasonal.month}</div>
        </div>
        <span
          className={s.tourismBadge}
          style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}
        >
          {seasonal.tourism_level}
        </span>
      </div>
      <div className={s.stats}>
        {seasonal.avg_temp_c != null && (
          <div className={s.stat}>
            <div className={s.statVal}>{seasonal.avg_temp_c}°</div>
            <div className={s.statUnit}>avg temp</div>
          </div>
        )}
        {seasonal.avg_precipitation_mm != null && (
          <div className={s.stat}>
            <div className={s.statVal}>{seasonal.avg_precipitation_mm}</div>
            <div className={s.statUnit}>mm rain/mo</div>
          </div>
        )}
      </div>
      {seasonal.insights?.length > 0 && (
        <div className={s.insights}>
          {seasonal.insights.map((ins, i) => (
            <div key={i} className={s.insight}>
              <span className={s.insightEmoji}>{ins.emoji}</span>
              <div className={s.insightBody}>
                <div className={s.insightTitle}>{ins.title}</div>
                <div className={s.insightDetail}>{ins.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
