import { createContext, useContext, useState, useCallback, useRef } from "react";
import { askClaude, askClaudeStream, requestVerification, parseJSON } from "../api.js";
import { buildSkeletonPrompt, buildDaysPrompt } from "../prompts.js";
import { useVerification } from "../hooks/useVerification.js";

const TripContext = createContext(null);

const STEPS=["from","to","when","who","budget","vibe","stay","extras","review"];

const defaultForm={
  origin:"",destinations:[],destInput:"",
  dateFrom:"",dateTo:"",dateFlexibility:"exact",
  adults:2,children:[],childAgeInput:"",
  budget:"",budgetType:"per_person",budgetFlexibility:"moderate",currency:"USD",
  tripTypes:[],activityLevel:"moderate",travelStyle:"balanced",
  accommodation:[],mustHaves:"",avoid:"",
  occasions:[],dietary:[],accessibility:"",climate:"any",
  groupDynamic:"couple",petFriendly:false,passportCountry:"",
  selectedActivities:[],
};

export function TripProvider({children}){
  const[form,setForm]=useState(defaultForm);
  const[step,setStep]=useState(0);
  const[loading,setLoading]=useState(false);
  const[loadingPhase,setLoadingPhase]=useState(null);
  const[tripData,setTripData]=useState(null);
  const[error,setError]=useState("");
  const[verification,setVerification]=useState(null);
  const[verifying,setVerifying]=useState(false);
  const[streamText,setStreamText]=useState("");
  const { startVerification, cancelVerification } = useVerification();

  const upd=useCallback((k,v)=>setForm(f=>({...f,[k]:v})),[]);
  const toggleArr=useCallback((k,id)=>setForm(f=>({...f,[k]:f[k].includes(id)?f[k].filter(x=>x!==id):[...f[k],id]})),[]);

  const toggleActivity=useCallback((act)=>{
    setForm(f=>{
      const exists=f.selectedActivities.some(a=>a.id===act.id);
      return{...f,selectedActivities:exists?f.selectedActivities.filter(a=>a.id!==act.id):[...f.selectedActivities,act]};
    });
  },[]);

  const reset=useCallback(()=>{
    cancelVerification();
    setTripData(null);setStep(0);setForm(defaultForm);setVerification(null);setVerifying(false);
  },[cancelVerification]);

  const generate=useCallback(async()=>{
    setLoading(true);setLoadingPhase("skeleton");setError("");setTripData(null);setVerification(null);setVerifying(false);setStreamText("");
    try{ await fetch("/api/clear-cache",{method:"POST"}); }catch(e){ /* Python may be offline */ }

    let skeleton=null;
    let lastErr="";
    for(let attempt=0;attempt<2;attempt++){
      try{
        setStreamText("");
        const text=await askClaudeStream(buildSkeletonPrompt(form),8000,(accumulated)=>{
          setStreamText(accumulated);
        });
        const parsed=parseJSON(text);
        parsed.budget=parsed.budget||{totalEstimate:"0",perPerson:"0",breakdown:[]};
        parsed.accommodations=parsed.accommodations||[];
        parsed.flights=parsed.flights||[];
        parsed.insiderTips=parsed.insiderTips||[];
        parsed.suggestedSplurges=parsed.suggestedSplurges||[];
        parsed.dayOutline=parsed.dayOutline||[];
        parsed.routeDestinations=parsed.routeDestinations||form.destinations||[];
        const budgetEmpty=!parsed.budget.totalEstimate||parsed.budget.totalEstimate==="0";
        const outlineMissing=parsed.dayOutline.length<(parsed.totalNights||7);
        if((budgetEmpty||outlineMissing)&&attempt<1){
          console.warn(`Skeleton attempt ${attempt+1}: budget=${parsed.budget.totalEstimate}, outline=${parsed.dayOutline.length}/${parsed.totalNights} — retrying`);
          throw new Error(`Skeleton incomplete: budget=${budgetEmpty?"empty":"ok"}, outline=${parsed.dayOutline.length}/${parsed.totalNights}`);
        }
        skeleton=parsed;
        break;
      }catch(e){
        lastErr=e.message;
        console.warn(`Skeleton attempt ${attempt+1} failed:`,e.message);
        if(attempt<1) await new Promise(r=>setTimeout(r,1500));
      }
    }
    if(!skeleton){
      setError("Failed to plan your trip - please try again. ("+lastErr+")");
      setLoading(false);setLoadingPhase(null);setStreamText("");
      return;
    }

    setLoadingPhase("days");setStreamText("");
    let days=[];
    for(let attempt=0;attempt<2;attempt++){
      try{
        const nights=skeleton.totalNights||7;
        const daysTokens=Math.min(24000,nights*1400+1000);
        const tokens=attempt>0?Math.min(28000,daysTokens+2000):daysTokens;
        const text=await askClaudeStream(buildDaysPrompt(skeleton,form),tokens,(accumulated)=>{
          setStreamText(accumulated);
        });
        const parsed=parseJSON(text);
        days=parsed.days||[];
        if(days.length<nights&&attempt<1){
          console.warn(`Days attempt ${attempt+1}: ${days.length}/${nights} days — retrying with more tokens`);
          throw new Error(`Days incomplete: ${days.length}/${nights}`);
        }
        break;
      }catch(e){
        lastErr=e.message;
        console.warn(`Days attempt ${attempt+1} failed:`,e.message);
        if(attempt<1) await new Promise(r=>setTimeout(r,1500));
      }
    }

    const tripDataObj={
      ...skeleton,
      days:days.length>0?days:(skeleton.dayOutline||[]).map(o=>({
        dayNum:o.dayNum,date:o.date,location:o.location,theme:o.theme,
        imageKeyword:o.location,activities:[],diningTip:null
      })),
      origin:form.origin,currency:form.currency,adults:form.adults,children:form.children.length
    };
    setTripData(tripDataObj);
    setLoading(false);setLoadingPhase(null);setStreamText("");

    setVerifying(true);
    const agentStatuses = [];
    startVerification(tripDataObj, form, {
      onUpdate: (snapshot, agent, status) => {
        // Accumulate agent statuses from each SSE event
        if (status) {
          const idx = agentStatuses.findIndex(s => s.agent === status.agent);
          if (idx >= 0) agentStatuses[idx] = status;
          else agentStatuses.push(status);
        }
        // Compute score from accumulated statuses
        const total = agentStatuses.length;
        const ok = agentStatuses.filter(s => s.status === "success" && s.result_count > 0).length;
        const score = total > 0 ? Math.round((ok / total) * 100) : 0;
        setVerification({ ...snapshot, agent_statuses: [...agentStatuses], verification_score: score });
      },
      onDone: (finalData) => {
        setVerifying(false);
        if (finalData) {
          // Use accumulated statuses if final snapshot has none
          const statuses = finalData.agent_statuses?.length > 0 ? finalData.agent_statuses : agentStatuses;
          const total = statuses.length;
          const ok = statuses.filter(s => s.status === "success" && s.result_count > 0).length;
          const score = total > 0 ? Math.round((ok / total) * 100) : (finalData.verification_score || 0);
          setVerification({ ...finalData, agent_statuses: [...statuses], verification_score: score });
        }
      },
      onError: () => {
        setVerifying(false);
      },
    });
  },[form,startVerification]);

  const canNext=useCallback(()=>{
    if(step===0)return form.origin.trim().length>0;
    if(step===2)return form.dateFrom&&form.dateTo;
    if(step===4)return form.budget.trim().length>0;
    return true;
  },[step,form.origin,form.dateFrom,form.dateTo,form.budget]);

  const value={
    // State
    form,step,loading,loadingPhase,tripData,error,verification,verifying,streamText,
    // Actions
    upd,toggleArr,toggleActivity,setStep,generate,reset,canNext,
    // Constants
    STEPS,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(){
  const ctx=useContext(TripContext);
  if(!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
