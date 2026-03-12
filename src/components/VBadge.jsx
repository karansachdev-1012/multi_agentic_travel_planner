import cs from "../styles/VBadge.module.css";

// ─── VERIFICATION BADGE ─────────────────────────────────────────────────────
const ICONS={verified:"\u2705",ai:"\u26A0\uFE0F",failed:"\u274C"};
const DEFAULTS={verified:"Verified",ai:"AI Estimate",failed:"Not Found"};

export function VBadge({type="ai",label,small}){
  const typeClass=cs[type]||cs.ai;
  const icon=ICONS[type]||ICONS.ai;
  const text=label||DEFAULTS[type]||DEFAULTS.ai;
  return(<span className={`${cs.badge} ${small?cs.badgeSmall:cs.badgeNormal} ${typeClass}`}>{icon} {text}</span>);
}

// ─── WEATHER WIDGET ─────────────────────────────────────────────────────────
export function WeatherWidget({weatherData,date}){
  if(!weatherData?.days?.length) return null;
  const dayData=weatherData.days.find(d=>d.date===date);
  if(!dayData) return null;
  return(
    <div className={cs.weatherWidget}>
      <span className={cs.weatherIcon}>{dayData.icon}</span>
      <div>
        <div className={cs.weatherTemp}>{Math.round(dayData.temp_high)}\u00B0/{Math.round(dayData.temp_low)}\u00B0</div>
        <div className={cs.weatherDesc}>{dayData.description}{dayData.precipitation_chance>20?` \u00B7 ${dayData.precipitation_chance}% rain`:""}</div>
      </div>
    </div>
  );
}
