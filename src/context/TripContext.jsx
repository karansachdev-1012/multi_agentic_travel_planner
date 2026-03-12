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

  // ─── Swap modal state ─────────────────────────────────────────────────────
  const[swapModal,setSwapModal]=useState(null);
  // { type: "hotel"|"restaurant", location, dayIndex, itemIndex, currentPrice, alternatives }

  // ─── Budget adjustments tracking ────────────────────────────────────────────
  const[budgetAdjustments,setBudgetAdjustments]=useState({ accommodation: 0, food: 0 });

  // ─── Budget selections: tracks which verified option is active per category ──
  // { hotels: { [location]: index }, flights: index }
  const[budgetSelections,setBudgetSelections]=useState({ hotels: {}, flights: 0 });

  const selectHotelOption=useCallback((location, index)=>{
    const prev=budgetSelections.hotels[location]??0;
    if(prev===index) return;
    setBudgetSelections(s=>({...s, hotels:{...s.hotels,[location]:index}}));
    // Recompute budget diff
    setTripData(td=>{
      if(!td?.budget?.breakdown) return td;
      const vh=verification?.hotels?.[location]||[];
      const oldH=vh[prev];
      const newH=vh[index];
      if(!oldH||!newH) return td;
      const nights=td.accommodations?.find(a=>a.location===location)?.nights||td.totalNights||7;
      const priceDiff=((newH.price_per_night||0)-(oldH.price_per_night||0))*nights;
      if(priceDiff===0) return td;
      setBudgetAdjustments(adj=>({...adj, accommodation: adj.accommodation+priceDiff}));
      const breakdown=td.budget.breakdown.map(row=>{
        if(row.category?.toLowerCase().includes("accommod")||row.category?.toLowerCase().includes("hotel")||row.category?.toLowerCase().includes("stay")){
          const oldTotal=parseFloat(String(row.total).replace(/[^0-9.]/g,""))||0;
          return{...row, total: String(Math.round(oldTotal+priceDiff)), _diff: (row._diff||0)+priceDiff};
        }
        return row;
      });
      const oldEstimate=parseFloat(String(td.budget.totalEstimate).replace(/[^0-9.]/g,""))||0;
      const pp=Math.round((oldEstimate+priceDiff)/(td.adults||2));
      return{...td, budget:{...td.budget, breakdown, totalEstimate: String(Math.round(oldEstimate+priceDiff)), perPerson: String(pp), _originalTotal: td.budget._originalTotal||td.budget.totalEstimate}};
    });
  },[budgetSelections,verification]);

  const selectFlightOption=useCallback((index)=>{
    const prev=budgetSelections.flights??0;
    if(prev===index) return;
    setBudgetSelections(s=>({...s, flights:index}));
    setTripData(td=>{
      if(!td?.budget?.breakdown) return td;
      const vf=verification?.flights||[];
      const oldF=vf[prev];
      const newF=vf[index];
      if(!oldF||!newF||!oldF.price||!newF.price) return td;
      const passengers=(td.adults||2)+(td.children||0);
      const priceDiff=(newF.price-oldF.price)*passengers;
      if(priceDiff===0) return td;
      const breakdown=td.budget.breakdown.map(row=>{
        if(row.category?.toLowerCase().includes("flight")||row.category?.toLowerCase().includes("air")||row.category?.toLowerCase().includes("transport")){
          const oldTotal=parseFloat(String(row.total).replace(/[^0-9.]/g,""))||0;
          return{...row, total: String(Math.round(oldTotal+priceDiff)), _diff: (row._diff||0)+priceDiff};
        }
        return row;
      });
      const oldEstimate=parseFloat(String(td.budget.totalEstimate).replace(/[^0-9.]/g,""))||0;
      const pp=Math.round((oldEstimate+priceDiff)/(td.adults||2));
      return{...td, budget:{...td.budget, breakdown, totalEstimate: String(Math.round(oldEstimate+priceDiff)), perPerson: String(pp), _originalTotal: td.budget._originalTotal||td.budget.totalEstimate}};
    });
  },[budgetSelections,verification]);

  const resetBudgetSelections=useCallback(()=>{
    setBudgetSelections({hotels:{},flights:0});
    setBudgetAdjustments({accommodation:0,food:0});
    setTripData(td=>{
      if(!td?.budget?._originalTotal) return td;
      const orig=td.budget._originalTotal;
      const pp=Math.round(Number(orig)/(td.adults||2));
      const breakdown=(td.budget.breakdown||[]).map(row=>({...row, _diff:undefined, total: row._originalTotal||row.total}));
      return{...td, budget:{...td.budget, totalEstimate: orig, perPerson: String(pp), _originalTotal: undefined, breakdown}};
    });
  },[]);

  const updateHotel=useCallback((location, index, newHotel)=>{
    setVerification(v=>{
      if(!v?.hotels?.[location]) return v;
      const oldHotel=v.hotels[location][index];
      const oldPrice=oldHotel?.price_per_night||0;
      const newPrice=newHotel?.price_per_night||0;

      // Calculate price diff based on total nights
      const nights=tripData?.totalNights||7;
      const priceDiff=(newPrice-oldPrice)*nights;

      if(priceDiff!==0){
        setBudgetAdjustments(adj=>({...adj, accommodation: adj.accommodation+priceDiff}));
        // Update budget breakdown in tripData
        setTripData(td=>{
          if(!td?.budget?.breakdown) return td;
          const breakdown=td.budget.breakdown.map(row=>{
            if(row.category?.toLowerCase().includes("accommod")||row.category?.toLowerCase().includes("hotel")||row.category?.toLowerCase().includes("stay")){
              const oldTotal=parseFloat(String(row.total).replace(/[^0-9.]/g,""))||0;
              return{...row, total: String(Math.round(oldTotal+priceDiff)), _diff: priceDiff};
            }
            return row;
          });
          const oldEstimate=parseFloat(String(td.budget.totalEstimate).replace(/[^0-9.]/g,""))||0;
          return{...td, budget:{...td.budget, breakdown, totalEstimate: String(Math.round(oldEstimate+priceDiff)), _originalTotal: td.budget._originalTotal||td.budget.totalEstimate}};
        });
      }

      return{
        ...v,
        hotels:{...v.hotels,[location]:v.hotels[location].map((h,i)=>i===index?newHotel:h)}
      };
    });
    setSwapModal(null);
  },[tripData?.totalNights]);

  const updateDiningTip=useCallback((dayIndex, newDining)=>{
    setTripData(td=>{
      if(!td?.days) return td;
      const oldDining=td.days[dayIndex]?.diningTip;
      const oldCost=oldDining?.estimatedCostPP||0;
      const newCost=newDining?.estimatedCostPP||0;
      const groupSize=(td.adults||2)+(td.children||0);
      const priceDiff=(newCost-oldCost)*groupSize;

      if(priceDiff!==0){
        setBudgetAdjustments(adj=>({...adj, food: adj.food+priceDiff}));
      }

      const newDays=td.days.map((d,i)=>i===dayIndex?{...d, diningTip: newDining}:d);

      if(priceDiff!==0 && td.budget?.breakdown){
        const breakdown=td.budget.breakdown.map(row=>{
          if(row.category?.toLowerCase().includes("food")||row.category?.toLowerCase().includes("dining")||row.category?.toLowerCase().includes("meal")){
            const oldTotal=parseFloat(String(row.total).replace(/[^0-9.]/g,""))||0;
            return{...row, total: String(Math.round(oldTotal+priceDiff)), _diff: (row._diff||0)+priceDiff};
          }
          return row;
        });
        const oldEstimate=parseFloat(String(td.budget.totalEstimate).replace(/[^0-9.]/g,""))||0;
        return{...td, days: newDays, budget:{...td.budget, breakdown, totalEstimate: String(Math.round(oldEstimate+priceDiff)), _originalTotal: td.budget._originalTotal||td.budget.totalEstimate}};
      }

      return{...td, days: newDays};
    });
    setSwapModal(null);
  },[]);

  const updateAccommodation=useCallback((stayIndex, optionIndex, newOption)=>{
    setTripData(td=>{
      if(!td?.accommodations) return td;
      const oldOpt=td.accommodations[stayIndex]?.options?.[optionIndex];
      const oldPrice=oldOpt?.pricePerNight||0;
      const newPrice=newOption?.pricePerNight||0;
      const nights=td.accommodations[stayIndex]?.nights||td.totalNights||7;
      const priceDiff=(newPrice-oldPrice)*nights;

      if(priceDiff!==0) setBudgetAdjustments(adj=>({...adj, accommodation: adj.accommodation+priceDiff}));

      return{
        ...td,
        accommodations: td.accommodations.map((acc,i)=>
          i===stayIndex?{...acc, options: acc.options.map((opt,j)=>j===optionIndex?newOption:opt)}:acc
        )
      };
    });
    setSwapModal(null);
  },[]);

  const reset=useCallback(()=>{
    cancelVerification();
    setTripData(null);setStep(0);setForm(defaultForm);setVerification(null);setVerifying(false);
    setSwapModal(null);setBudgetAdjustments({accommodation:0,food:0});
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
    swapModal,budgetAdjustments,budgetSelections,
    // Actions
    upd,toggleArr,toggleActivity,setStep,generate,reset,canNext,
    setSwapModal,updateHotel,updateDiningTip,updateAccommodation,
    selectHotelOption,selectFlightOption,resetBudgetSelections,
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
