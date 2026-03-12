import { useState, useEffect, useCallback } from "react";
import { askClaude, parseJSON } from "../api.js";
import s from "../styles/VisaChecker.module.css";

// ─── SMART VISA CHECKER ────────────────────────────────────────────────────
export function VisaChecker({passport,destinations}){
  const [info,setInfo]=useState(null);
  const [loading,setLoading]=useState(false);
  const [fetched,setFetched]=useState("");
  const [hasVisa,setHasVisa]=useState({});

  const key=`${passport}::${destinations.join(",")}`;

  const check=useCallback(async(force=false)=>{
    if(!passport||destinations.length===0)return;
    if(key===fetched&&!force)return;
    setLoading(true); setInfo(null); setHasVisa({});
    try{
      const text=await askClaude(
        `Visa requirements for a ${passport} passport holder travelling to: ${destinations.join(", ")}.
Return ONLY valid JSON, no markdown, no explanation:
{
  "overall":"visa_free|visa_on_arrival|evisa|visa_required|mixed",
  "generalAdvice":"one practical sentence",
  "destinations":[
    {
      "country":"Country name",
      "status":"visa_free|visa_on_arrival|evisa|visa_required",
      "statusLabel":"e.g. Visa-Free 90 days",
      "stayLimit":"e.g. 90 days",
      "passportValidity":"e.g. 6 months beyond travel date",
      "notes":"Key practical entry requirement note",
      "visaType":"Tourist Visa / eVisa / null if not needed",
      "applyUrl":"official visa portal URL (best available)",
      "processingTime":"e.g. 3-5 business days / Instant / On arrival",
      "fee":"Free / $35 / On arrival $50",
      "documentsNeeded":["item1","item2","item3"],
      "tips":"One genuinely useful tip for this passport+country combo"
    }
  ]
}`,700
      );
      const parsed=parseJSON(text);
      setInfo(parsed); setFetched(key);
    }catch(e){
      setInfo({overall:"mixed",generalAdvice:"Auto-check failed. Verify manually at IATA Travel Centre.",destinations:destinations.map(d=>({country:d,status:"visa_required",statusLabel:"Check Manually",stayLimit:"Unknown",notes:"Could not auto-check. Verify at official embassy website.",applyUrl:"https://www.iatatravelcentre.com/passport-visa-health-travel-document-requirements.htm",documentsNeeded:[],tips:"Always confirm visa requirements before booking travel."}))});
    }
    setLoading(false);
  },[passport,destinations.join(","),key,fetched]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(passport&&destinations.length>0)check();},[passport,destinations.join(",")]);

  if(!passport||destinations.length===0) return(
    <div className={s.emptyState}>
      Enter your passport nationality in Step 1 and a destination above to get a live visa check
    </div>
  );

  const sC={visa_free:"#4caf8e",visa_on_arrival:"#d4a843",evisa:"#e8a060",visa_required:"#e87070",mixed:"#e8a060"};
  const sBg={visa_free:"rgba(76,175,142,.11)",visa_on_arrival:"rgba(212,168,67,.11)",evisa:"rgba(232,160,96,.11)",visa_required:"rgba(232,112,112,.11)",mixed:"rgba(232,160,96,.11)"};
  const sE={visa_free:"\u{2705}",visa_on_arrival:"\u{1F7E1}",evisa:"\u{1F535}",visa_required:"\u{1F534}",mixed:"\u{26A0}\u{FE0F}"};
  const col=st=>sC[st]||"#888"; const bg=st=>sBg[st]||"rgba(255,255,255,.05)"; const em=st=>sE[st]||"\u{2753}";

  return(
    <div className={s.container}>
      <div className={s.headerRow}>
        <div className={s.headerTitle}>Visa Requirements</div>
        {loading&&<span className={s.checkingText}>Checking for {passport} passport...</span>}
        {!loading&&info&&<button onClick={()=>check(true)} className={s.recheckBtn}>Recheck</button>}
      </div>

      {loading&&(
        <div className={s.loadingBox}>
          <span className={s.loadingIcon}>passport</span>
          <span className={s.loadingLabel}>Checking visa requirements for {passport} to {destinations.join(", ")}...</span>
        </div>
      )}

      {!loading&&info&&(
        <div>
          <div className={s.overallBanner} style={{background:bg(info.overall),border:`1px solid ${col(info.overall)}28`}}>
            <span className={s.overallEmoji}>{em(info.overall)}</span>
            <div>
              <div className={s.overallTitle} style={{color:col(info.overall)}}>
                {info.overall==="visa_free"?"Visa-Free - No visa needed"
                  :info.overall==="visa_on_arrival"?"Visa on Arrival Available"
                  :info.overall==="evisa"?"eVisa Required - Apply Online"
                  :info.overall==="visa_required"?"Visa Required - Apply in Advance"
                  :"Mixed - Check Each Destination Below"}
              </div>
              {info.generalAdvice&&<div className={s.overallAdvice}>{info.generalAdvice}</div>}
            </div>
          </div>

          {(info.destinations||[]).map((d,i)=>{
            const needsVisa=d.status!=="visa_free";
            const already=hasVisa[d.country];
            return(
              <div key={i} className={s.destCard}>
                <div className={s.destHeader}>
                  <div className={s.destHeaderLeft}>
                    <span className={s.destEmoji}>{em(d.status)}</span>
                    <div>
                      <div className={s.destName}>{d.country}</div>
                      {d.stayLimit&&<div className={s.destStay}>Stay limit: {d.stayLimit}</div>}
                    </div>
                  </div>
                  <div className={s.statusBadge} style={{background:bg(d.status),border:`1px solid ${col(d.status)}38`,color:col(d.status)}}>{d.statusLabel}</div>
                </div>

                <div className={s.destBody}>
                  {d.passportValidity&&<div className={s.passportValidity}>
                    <span>Passport validity needed: {d.passportValidity}</span>
                  </div>}
                  {d.notes&&<div className={s.notes}>
                    <span>{d.notes}</span>
                  </div>}

                  {!needsVisa&&(
                    <div className={s.visaFreeBox}>
                      <span className={s.visaFreeText}>No visa required for {passport} passport holders - just show up with a valid passport.</span>
                    </div>
                  )}

                  {needsVisa&&(
                    <div>
                      <div className={s.visaQuestion}>Do you already hold a visa for {d.country}?</div>
                      <div className={s.visaBtnRow}>
                        {[{val:"yes",label:"Yes, I have it",bg:"rgba(76,175,142,.1)",border:"rgba(76,175,142,.35)",color:"#4caf8e"},
                          {val:"no",label:"No, I need to apply",bg:"rgba(232,112,112,.1)",border:"rgba(232,112,112,.35)",color:"#e87070"}
                        ].map(o=>(
                          <button key={o.val} onClick={()=>setHasVisa(v=>({...v,[d.country]:o.val}))}
                            className={s.visaBtn}
                            style={{
                              border:`1.5px solid ${already===o.val?o.border:"rgba(255,255,255,.1)"}`,
                              background:already===o.val?o.bg:"rgba(255,255,255,.04)",
                              color:already===o.val?o.color:"#888"}}>
                            {o.label}
                          </button>
                        ))}
                      </div>

                      {already==="yes"&&(
                        <div className={s.hasVisaBox}>
                          <div className={s.hasVisaTitle}>Great - you're all set for {d.country}!</div>
                          <div className={s.hasVisaDesc}>Make sure your visa is valid for your travel dates ({d.stayLimit}){d.passportValidity?` and your passport is valid for ${d.passportValidity}`:""}.{d.tips&&" "+d.tips}</div>
                        </div>
                      )}

                      {already==="no"&&(
                        <div>
                          <div className={s.visaPills}>
                            {d.fee&&<span className={s.visaPillGold}>Fee: {d.fee}</span>}
                            {d.processingTime&&<span className={s.visaPillNeutral}>{d.processingTime}</span>}
                            {d.visaType&&<span className={s.visaPillNeutral}>{d.visaType}</span>}
                          </div>

                          {d.documentsNeeded?.length>0&&(
                            <div style={{marginBottom:12}}>
                              <div className={s.docsTitle}>Documents Required</div>
                              <div className={s.docsList}>
                                {d.documentsNeeded.map(doc=><span key={doc} className={s.docItem}>{doc}</span>)}
                              </div>
                            </div>
                          )}

                          {d.tips&&<div className={s.tipBox}>{d.tips}</div>}

                          <div className={s.visaActions}>
                            {d.applyUrl&&<a href={d.applyUrl} target="_blank" rel="noreferrer" className={s.applyBtn}>Apply for Visa Now</a>}
                          </div>
                        </div>
                      )}

                      {!already&&(
                        <div className={s.noSelection}>
                          Tell us whether you have this visa to see what you need to do
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
