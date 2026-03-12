import { useState, useEffect, useCallback } from "react";
import { askClaude } from "../api.js";
import s from "../styles/ActivityCheckboxes.module.css";

// ─── ACTIVITY CHECKBOX PICKER ──────────────────────────────────────────────
export function ActivityCheckboxes({destinations, selected, onToggle}){
  const [activities,setActivities]=useState([]);
  const [loading,setLoading]=useState(false);
  const [fetched,setFetched]=useState("");
  const dest=destinations.join(", ");

  const load=useCallback(async(force=false)=>{
    if(!dest||(dest===fetched&&!force))return;
    setLoading(true);
    setActivities([]);
    let lastErr="";
    for(let attempt=0;attempt<2;attempt++){
      try{
        const text=await askClaude(
          `List exactly 12 must-do experiences for a trip to: ${dest}.
Vary the categories: sightseeing, food, adventure, nature, culture, nightlife, wellness.
Return ONLY a raw JSON array. No markdown. No backticks. No explanation. Start with [ and end with ].
Each item: {"id":"a${attempt}_N","icon":"single emoji","label":"2-4 word name","desc":"One sentence naming a real place or dish.","category":"Culture or Adventure or Food or Nature or Nightlife or Wellness or Sightseeing"}
Exactly 12 items. Be specific to ${dest}.`,700
        );
        let t=text.replace(/```json|```/g,"").trim();
        const sa=t.indexOf("["), ea=t.lastIndexOf("]");
        if(sa<0||ea<0) throw new Error("No array found in response");
        t=t.slice(sa,ea+1);
        t=t.replace(/,(\s*[\]}])/g,"$1");
        const arr=JSON.parse(t);
        if(!Array.isArray(arr)||arr.length===0) throw new Error("Empty array returned");
        setActivities(arr); setFetched(dest);
        setLoading(false);
        return;
      }catch(e){
        lastErr=e.message;
        if(attempt===0) await new Promise(r=>setTimeout(r,800));
      }
    }
    setActivities([{id:"err",icon:"\u{26A0}\u{FE0F}",label:"Load failed",desc:"Error: "+lastErr+". Click Refresh to try again.",category:"Info"}]);
    setLoading(false);
  },[dest,fetched]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(destinations.length>0)load();},[destinations.length]);

  if(!destinations.length)return(
    <div className={s.emptyState}>
      Add a destination first to see activity suggestions
    </div>
  );

  const byCategory={};
  activities.forEach(a=>{const c=a.category||"Other";if(!byCategory[c])byCategory[c]=[];byCategory[c].push(a);});

  return(
    <div className={s.container}>
      <div className={s.header}>
        <div className={s.headerTitle}>
          Must-Do Experiences in {destinations[0]}{destinations.length>1?` + ${destinations.length-1} more`:""}
        </div>
        <div className={s.headerRight}>
          {selected.length>0&&<span className={s.selectedCount}>{selected.length} selected</span>}
          {loading?<span className={s.loadingText}>Loading...</span>
            :<button onClick={()=>load(true)} className={s.refreshBtn}>Refresh</button>}
        </div>
      </div>

      {loading&&(
        <div className={s.skeleton}>
          {[1,2,3,4,5,6].map(i=><div key={i} className={s.skeletonBar} style={{animationDelay:`${i*0.1}s`}}/>)}
        </div>
      )}

      {!loading&&activities.length>0&&Object.entries(byCategory).map(([cat,acts])=>(
        <div key={cat} className={s.category}>
          <div className={s.categoryTitle}>{cat}</div>
          <div className={s.categoryList}>
            {acts.map(act=>{
              const isOn=selected.some(s=>s.id===act.id);
              return(
                <label key={act.id} className={isOn?s.actLabelActive:s.actLabelInactive}>
                  <div className={s.checkWrap}>
                    <input type="checkbox" checked={isOn} onChange={()=>onToggle(act)} className={s.checkInput}/>
                    <div className={isOn?s.checkBoxOn:s.checkBoxOff}>
                      {isOn&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#080706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                  <div className={s.actContent}>
                    <div className={s.actHeader}>
                      <span className={s.actIcon}>{act.icon}</span>
                      <span className={isOn?s.actNameActive:s.actNameInactive}>{act.label}</span>
                    </div>
                    <div className={s.actDesc}>{act.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {!loading&&activities.length===0&&(
        <div className={s.fallback}>Could not load suggestions — <button onClick={()=>load(true)} className={s.retryBtn}>try again</button></div>
      )}
    </div>
  );
}
