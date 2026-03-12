import { useRef, useEffect } from "react";
import s from "../styles/LoadingView.module.css";

// ─── LOADING VIEW ───────────────────────────────────────────────────────────
export function LoadingView({loadingPhase,streamText}){
  const scrollRef=useRef(null);

  // Auto-scroll to bottom as new text streams in
  useEffect(()=>{
    if(scrollRef.current){
      scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
    }
  },[streamText]);

  // Show a truncated preview of the raw JSON stream
  const preview=streamText
    ? streamText.length>2000
      ? "..."+streamText.slice(-2000)
      : streamText
    : "";

  const chars=streamText?.length||0;

  return(
    <div className={s.container}>
      <div className={s.spinner}>{"\u2728"}</div>
      <div className={s.title}>
        {loadingPhase==="skeleton"?"Planning your trip...":loadingPhase==="days"?"Building daily itinerary...":"Preparing your guide..."}
      </div>
      <div className={s.subtitle}>
        {loadingPhase==="skeleton"?"Budget, flights, accommodations & insider tips":loadingPhase==="days"?"Day-by-day activities, restaurants & hidden gems":"Almost there..."}
      </div>
      <div className={s.progressBars}>
        <div className={`${s.bar} ${loadingPhase==="skeleton"?s.barActive:s.barHalf}`}/>
        <div className={`${s.bar} ${loadingPhase==="days"?s.barActive:s.barInactive}`}/>
        <div className={`${s.bar} ${s.barInactive}`}/>
      </div>
      <div className={s.phases}>
        <span className={loadingPhase==="skeleton"?s.phaseActive:loadingPhase==="days"?s.phaseDone:s.phasePending}>
          {loadingPhase==="days"?"\u2705":"\uD83E\uDDE0"} Trip Skeleton
        </span>
        <span className={s.arrow}>{"\u2192"}</span>
        <span className={loadingPhase==="days"?s.phaseActive:s.phasePending}>
          {"\uD83D\uDCC5"} Daily Details
        </span>
        <span className={s.arrow}>{"\u2192"}</span>
        <span className={s.phasePending}>{"\uD83D\uDD0D"} Verification</span>
      </div>

      {/* Live streaming text panel */}
      {preview&&(
        <div className={s.streamPanel}>
          <div className={s.streamHeader}>
            <span className={s.streamLabel}>
              {loadingPhase==="skeleton"?"AI Planning":"AI Writing"} — Live
            </span>
            <span className={s.streamSize}>{chars.toLocaleString()} chars</span>
          </div>
          <div className={s.streamBody} ref={scrollRef}>
            {preview}<span className={s.streamCursor}/>
          </div>
        </div>
      )}
    </div>
  );
}
