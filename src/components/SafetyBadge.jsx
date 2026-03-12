import s from "../styles/SafetyBadge.module.css";

const LEVEL_COLORS = {
  low: "#4caf8e",
  moderate: "#d4a843",
  high: "#e8a060",
  extreme: "#e87070",
  do_not_travel: "#e85050",
  unknown: "#888",
};

const ALERT_BORDER_COLORS = {
  low: "#4caf8e",
  moderate: "#d4a843",
  high: "#e8a060",
  extreme: "#e87070",
};

/**
 * SafetyBadge — shows travel advisory info for a destination.
 * Two variants:
 * - Card (default): full card for sidebar use
 * - Inline (inline=true): compact pill for hero stats
 */
export function SafetyBadge({ safety, inline = false }) {
  if (!safety || safety.error) return null;

  const color = LEVEL_COLORS[safety.level] || LEVEL_COLORS.unknown;
  const safetyPct = Math.max(0, Math.min(100, ((5 - safety.score) / 5) * 100));

  if (inline) {
    return (
      <span
        className={s.inline}
        style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
      >
        <span className={s.inlineEmoji}>{safety.emoji}</span>
        <span className={s.inlineText}>{safety.level === "do_not_travel" ? "Avoid" : safety.level} risk</span>
      </span>
    );
  }

  return (
    <div className={s.card}>
      <div className={s.label}>Travel Advisory</div>
      <div className={s.main}>
        <span className={s.emoji}>{safety.emoji}</span>
        <div className={s.info}>
          <div className={s.level} style={{ color }}>
            {safety.level === "do_not_travel" ? "Do Not Travel" : `${safety.level} Risk`}
          </div>
          <div className={s.score}>
            Advisory score: {safety.score}/5.0
            {safety.country_name ? ` — ${safety.country_name}` : ""}
          </div>
        </div>
      </div>
      <div className={s.bar}>
        <div
          className={s.barFill}
          style={{ width: `${safetyPct}%`, background: color }}
        />
      </div>
      {safety.advice && <div className={s.advice}>{safety.advice}</div>}
      {safety.sources_active > 0 && (
        <div className={s.sources}>
          Based on {safety.sources_active} international sources
          {safety.updated ? ` — updated ${safety.updated}` : ""}
        </div>
      )}
      {safety.alerts?.length > 0 && (
        <div className={s.alerts}>
          {safety.alerts.map((a, i) => (
            <div
              key={i}
              className={s.alert}
              style={{ borderColor: ALERT_BORDER_COLORS[a.severity] || "#888" }}
            >
              {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
