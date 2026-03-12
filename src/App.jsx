import { TripProvider, useTrip } from "./context/TripContext.jsx";
import { FormSteps } from "./components/FormSteps.jsx";
import { TripGuide } from "./components/TripGuide.jsx";
import { LoadingView } from "./components/LoadingView.jsx";
import styles from "./styles/App.module.css";

// ─── STEP LABELS ────────────────────────────────────────────────────────────
const STEP_LABELS=["From","To","When","Who","Money","Vibe","Stay","Details","Go"];

// ─── INNER APP (uses context) ───────────────────────────────────────────────
function AppInner(){
  const { form,step,setStep,loading,loadingPhase,tripData,error,verification,verifying,streamText,
          upd,toggleArr,toggleActivity,generate,reset,canNext,STEPS } = useTrip();

  if(tripData) return (<TripGuide data={tripData} form={form} verification={verification} verifying={verifying} onReset={reset}/>);

  return(
    <div className={styles.appShell}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.logo}>TripMind</div>
            <div className={styles.logoSub}>AI TRAVEL PLANNER</div>
          </div>
          <div className={styles.stepCount}>Step {step+1} / {STEPS.length}</div>
        </div>
        <div className={styles.progressBar}>
          {STEPS.map((_,i)=><div key={i} onClick={()=>i<step&&setStep(i)} className={`${styles.progressSegment} ${i<=step?styles.progressSegmentActive:styles.progressSegmentInactive}`} style={{cursor:i<step?"pointer":"default"}}/>)}
        </div>
        <div className={styles.stepLabels}>
          {STEP_LABELS.map((l,i)=><div key={i} onClick={()=>i<step&&setStep(i)} className={`${styles.stepLabel} ${i===step?styles.stepLabelCurrent:i<step?styles.stepLabelDone:styles.stepLabelFuture}`}>{l}</div>)}
        </div>
      </div>

      <div className={styles.content}>
        {loading
          ?<LoadingView loadingPhase={loadingPhase} streamText={streamText}/>
          :<div className={styles.formCard}>
            <FormSteps step={step} form={form} upd={upd} toggleArr={toggleArr} toggleActivity={toggleActivity} loading={loading} error={error} generate={generate}/>
            {STEPS[step]!=="review"&&(
              <div className={styles.formNav}>
                <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} className={styles.backBtn}>Back</button>
                <button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} className={`${styles.nextBtn} ${canNext()?styles.nextBtnActive:styles.nextBtnDisabled}`}>
                  {step===STEPS.length-2?"Review":"Next"}
                </button>
              </div>
            )}
          </div>
        }
      </div>
    </div>
  );
}

// ─── ROOT APP (wraps in provider) ───────────────────────────────────────────
export default function App(){
  return(
    <TripProvider>
      <AppInner/>
    </TripProvider>
  );
}
