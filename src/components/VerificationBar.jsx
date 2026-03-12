import cs from "../styles/VerificationBar.module.css";

// ─── VERIFICATION SUMMARY BAR ───────────────────────────────────────────────
export function VerificationBar({verification,verifying}){
  if(verifying){
    const statuses=verification?.agent_statuses||[];
    const done=statuses.filter(s=>s.status==="success"||s.status==="failed").length;
    return(
      <div className={`${cs.barBase} ${cs.verifying}`}>
        <span className={cs.spinIcon}>{"\uD83D\uDD04"}</span>
        <span className={cs.verifyingText}>
          Verifying with real data{done>0?` — ${done} agent${done>1?"s":""} done`:"..."}
        </span>
        {statuses.map(s=>(
          <span key={s.agent} className={`${cs.agentPill} ${s.status==="success"?cs.agentSuccess:s.status==="failed"?cs.agentFailed:cs.agentRunning}`}>
            {s.status==="success"?"\u2705":s.status==="failed"?"\u274C":"\u23F3"} {s.agent.split(":")[0]}
          </span>
        ))}
      </div>
    );
  }
  if(!verification) return null;
  const total=verification.agent_statuses?.length||0;
  const ok=verification.agent_statuses?.filter(s=>s.status==="success").length||0;
  return(
    <div className={`${cs.barBase} ${cs.verified}`}>
      <div className={cs.verifiedInfo}>
        <span>{"\u2705"}</span>
        <span className={cs.verifiedCount}>{ok}/{total} agents verified</span>
        <span className={cs.verifiedScore}>Score: {verification.verification_score?.toFixed(0)}%</span>
      </div>
      <div className={cs.dots}>
        {verification.agent_statuses?.map(s=>(
          <span key={s.agent} title={`${s.agent}: ${s.status} (${s.duration_ms}ms)`} className={`${cs.dot} ${s.status==="success"?cs.dotSuccess:s.status==="failed"?cs.dotFailed:cs.dotOther}`}/>
        ))}
      </div>
    </div>
  );
}
