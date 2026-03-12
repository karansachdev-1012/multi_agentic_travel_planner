import { TRIP_TYPES, OCCASIONS, DIETARY_OPTIONS, ACCOMMODATION_TYPES } from "../constants.js";
import { Chip, RGroup, MGroup, InpF } from "./Chip.jsx";
import { ActivityCheckboxes } from "./ActivityCheckboxes.jsx";
import { VisaChecker } from "./VisaChecker.jsx";
import chipStyles from "../styles/Chip.module.css";
import s from "../styles/FormSteps.module.css";

const STEPS=["from","to","when","who","budget","vibe","stay","extras","review"];

// ─── FORM STEPS ─────────────────────────────────────────────────────────────
export function FormSteps({step,form,upd,toggleArr,toggleActivity,loading,error,generate}){

  switch(STEPS[step]){

    case"from": return (<>
      <span className={s.title}>Where are you flying from?</span>
      <span className={s.subtitle}>Your departure city or nearest airport</span>
      <InpF label="Home City / Airport" value={form.origin} onChange={v=>upd("origin",v)} placeholder="Chicago, IL / London / Dubai / Mumbai / Sydney"/>
      <InpF label="Passport / Nationality" value={form.passportCountry} onChange={v=>upd("passportCountry",v)} placeholder="e.g. US, British, Canadian, Indian, Australian"/>
      {form.passportCountry.length>1&&<div className={s.passportHint}>Visa requirements will be checked automatically when you add a destination</div>}
    </>);

    case"to": return (<>
      <span className={s.title}>Where do you want to go?</span>
      <span className={s.subtitle}>Add one or more destinations - or leave blank for AI suggestions</span>
      <div className={s.destRow}>
        <input value={form.destInput} onChange={e=>upd("destInput",e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&form.destInput.trim()){upd("destinations",[...form.destinations,form.destInput.trim()]);upd("destInput","");}}}
          placeholder="Type a city / country and press Enter" className={chipStyles.input} style={{flex:1}}/>
        <button onClick={()=>{if(form.destInput.trim()){upd("destinations",[...form.destinations,form.destInput.trim()]);upd("destInput","");}}}
          className={s.destAddBtn}>+</button>
      </div>
      {form.destinations.length>0
        ?<div className={s.destTags}>{form.destinations.map((d,i)=><span key={i} className={s.tag}>{d}<button onClick={()=>upd("destinations",form.destinations.filter((_,j)=>j!==i))} className={s.tagClose}>x</button></span>)}</div>
        :<div className={s.destEmpty}>Leave empty - AI will suggest the perfect destination based on your preferences and budget</div>
      }
      <VisaChecker passport={form.passportCountry} destinations={form.destinations}/>
    </>);

    case"when": return (<>
      <span className={s.title}>When are you travelling?</span>
      <span className={s.subtitle}>Your ideal dates and how flexible you are</span>
      <div className={s.dateGrid}>
        <div><label className={chipStyles.label}>Departure</label><input type="date" value={form.dateFrom} onChange={e=>upd("dateFrom",e.target.value)} className={chipStyles.input}/></div>
        <div><label className={chipStyles.label}>Return</label><input type="date" value={form.dateTo} onChange={e=>upd("dateTo",e.target.value)} className={chipStyles.input}/></div>
      </div>
      <label className={chipStyles.label}>Date Flexibility</label>
      <RGroup options={[{id:"exact",l:"Exact dates"},{id:"few_days",l:"+-3 days"},{id:"week",l:"+-1 week"},{id:"very_flexible",l:"Very flexible"}]} value={form.dateFlexibility} onChange={v=>upd("dateFlexibility",v)}/>
    </>);

    case"who": return (<>
      <span className={s.title}>Who's coming?</span>
      <span className={s.subtitle}>Group size, vibe, and what are you celebrating?</span>
      <div className={s.whoGrid}>
        <div>
          <label className={chipStyles.label}>Adults</label>
          <div className={s.counterWrap}>
            <button onClick={()=>upd("adults",Math.max(1,form.adults-1))} className={s.counterBtn}>-</button>
            <span className={s.counterVal}>{form.adults}</span>
            <button onClick={()=>upd("adults",form.adults+1)} className={s.counterBtn}>+</button>
          </div>
        </div>
        <div>
          <label className={chipStyles.label}>Children (enter age)</label>
          <div className={s.counterWrap}>
            <input value={form.childAgeInput} onChange={e=>upd("childAgeInput",e.target.value)} type="number" min="0" max="17" placeholder="Age"
              onKeyDown={e=>{if(e.key==="Enter"){const a=parseInt(form.childAgeInput);if(!isNaN(a)&&a>=0&&a<=17){upd("children",[...form.children,a]);upd("childAgeInput","");}}}} className={s.childInput}/>
            <button onClick={()=>{const a=parseInt(form.childAgeInput);if(!isNaN(a)&&a>=0&&a<=17){upd("children",[...form.children,a]);upd("childAgeInput","");}}}
              className={s.childAddBtn}>+</button>
          </div>
          {form.children.length>0&&<div className={s.childTags}>{form.children.map((a,i)=><span key={i} className={s.tag}>{a}y<button onClick={()=>upd("children",form.children.filter((_,j)=>j!==i))} className={s.tagCloseSmall}>x</button></span>)}</div>}
        </div>
      </div>
      <label className={chipStyles.label}>Group Dynamic</label>
      <div className={s.groupDynamic}>
        <RGroup options={[{id:"solo",i:"\u{1F9CD}",l:"Solo"},{id:"couple",i:"\u{1F491}",l:"Couple"},{id:"friends",i:"\u{1FAC2}",l:"Friends"},{id:"family",i:"\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}",l:"Family"},{id:"corporate",i:"\u{1F4BC}",l:"Corporate"},{id:"multi_gen",i:"\u{1F474}",l:"Multi-gen"}]} value={form.groupDynamic} onChange={v=>upd("groupDynamic",v)}/>
      </div>
      <label className={chipStyles.label}>Occasions / Celebrations <span className={s.labelHint}>(select all that apply)</span></label>
      <div className={s.occasionWrap}>
        {OCCASIONS.map(o=><Chip key={o.id} active={form.occasions.includes(o.id)} onClick={()=>toggleArr("occasions",o.id)} icon={o.i} label={o.l} color="#c992e8"/>)}
      </div>
      {form.occasions.length>0&&<div className={s.occasionInfo}>
        Celebrating: {form.occasions.map(id=>OCCASIONS.find(o=>o.id===id)?.l).join(", ")}
      </div>}
    </>);

    case"budget": return (<>
      <span className={s.title}>What's your budget?</span>
      <span className={s.subtitle}>Be honest - this shapes every hotel, flight and activity recommendation</span>
      <div className={s.budgetGrid}>
        <div><label className={chipStyles.label}>Currency</label>
          <select value={form.currency} onChange={e=>upd("currency",e.target.value)} className={chipStyles.input}>
            {["USD","GBP","EUR","CAD","AUD","AED","JPY","INR","SGD","CHF"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <InpF label="Amount" value={form.budget} onChange={v=>upd("budget",v)} placeholder="e.g. 3000" type="number"/>
      </div>
      <label className={chipStyles.label}>Budget covers...</label>
      <div className={s.budgetCovers}><RGroup options={[{id:"per_person",l:"Per person (full trip)"},{id:"total",l:"Total for whole group"},{id:"per_day",l:"Per person / day"}]} value={form.budgetType} onChange={v=>upd("budgetType",v)}/></div>
      <label className={chipStyles.label}>Budget Flexibility</label>
      <RGroup options={[{id:"strict",i:"\u{1F512}",l:"Strict"},{id:"moderate",i:"\u{1F90F}",l:"+-15-20%"},{id:"flexible",i:"\u{1F4B8}",l:"Flexible"},{id:"unlimited",i:"\u{1F48E}",l:"No limit"}]} value={form.budgetFlexibility} onChange={v=>upd("budgetFlexibility",v)}/>
    </>);

    case"vibe": return (<>
      <span className={s.title}>What's the vibe?</span>
      <span className={s.subtitle}>Pick everything that fits, then choose specific experiences you want</span>
      <label className={chipStyles.label}>Trip Type</label>
      <div className={s.vibeChips}>
        {TRIP_TYPES.map(t=><Chip key={t.id} active={form.tripTypes.includes(t.id)} onClick={()=>toggleArr("tripTypes",t.id)} icon={t.i} label={t.l}/>)}
      </div>
      <label className={chipStyles.label}>Activity Level</label>
      <div className={s.activityLevel}><RGroup options={[{id:"lazy",i:"\u{1F6CB}\u{FE0F}",l:"Lazy"},{id:"moderate",i:"\u{1F6B6}",l:"Moderate"},{id:"active",i:"\u{1F3C3}",l:"Active"},{id:"extreme",i:"\u{1F9D7}",l:"Extreme"}]} value={form.activityLevel} onChange={v=>upd("activityLevel",v)}/></div>
      <label className={chipStyles.label}>Climate Preference</label>
      <div className={s.climate}><RGroup options={[{id:"hot",i:"\u{2600}\u{FE0F}",l:"Hot & Sunny"},{id:"mild",i:"\u{1F324}\u{FE0F}",l:"Mild"},{id:"cold",i:"\u{2744}\u{FE0F}",l:"Cold/Snow"},{id:"tropical",i:"\u{1F334}",l:"Tropical"},{id:"any",l:"Any"}]} value={form.climate} onChange={v=>upd("climate",v)}/></div>

      <div className={s.activityBox}>
        <ActivityCheckboxes destinations={form.destinations} selected={form.selectedActivities} onToggle={toggleActivity}/>
      </div>
    </>);

    case"stay": return (<>
      <span className={s.title}>Where do you sleep?</span>
      <span className={s.subtitle}>Pick your accommodation style(s)</span>
      <div className={s.stayChips}>
        {ACCOMMODATION_TYPES.map(t=><Chip key={t.id} active={form.accommodation.includes(t.id)} onClick={()=>toggleArr("accommodation",t.id)} icon={t.i} label={t.l}/>)}
      </div>
      <label className={chipStyles.label}>Planning Style</label>
      <div className={s.styleOptions}>
        {[{id:"spontaneous",i:"\u{1F3B2}",l:"Pure Spontaneous",d:"Wing it - no pre-planning"},{id:"balanced",i:"\u{2696}\u{FE0F}",l:"Balanced",d:"Key anchors booked, free time in between"},{id:"planned",i:"\u{1F4CB}",l:"Well-Planned",d:"Full day-by-day itinerary"},{id:"ultra_planned",i:"\u{1F5C2}\u{FE0F}",l:"Ultra-Planned",d:"Every meal and transfer pre-booked"}].map(o=>(
          <button key={o.id} onClick={()=>upd("travelStyle",o.id)} className={form.travelStyle===o.id?s.styleBtnActive:s.styleBtnInactive}>
            <span className={s.styleName}>{o.i} {o.l}</span><span className={s.styleDesc}>{o.d}</span>
          </button>
        ))}
      </div>
    </>);

    case"extras": return (<>
      <span className={s.title}>Food & final details</span>
      <span className={s.subtitle}>Dietary needs for everyone in the group</span>
      <label className={chipStyles.label}>Dietary Requirements <span className={s.labelHint}>(select all that apply across the group)</span></label>

      <div className={s.dietGrid}>
        {DIETARY_OPTIONS.map(d=>{
          const on=form.dietary.includes(d.id);
          return(
            <label key={d.id} className={on?s.dietLabelActive:s.dietLabelInactive}>
              <div className={s.checkboxWrap}>
                <input type="checkbox" checked={on} onChange={()=>toggleArr("dietary",d.id)} className={s.checkboxInput}/>
                <div className={on?s.checkboxChecked:s.checkboxUnchecked}>
                  {on&&<svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#080706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
              <div>
                <div className={on?s.dietNameActive:s.dietNameInactive}><span>{d.i}</span>{d.l}</div>
                <div className={s.dietDesc}>{d.desc}</div>
              </div>
            </label>
          );
        })}
      </div>

      {form.dietary.length>0&&<div className={s.dietInfo}>
        Accommodating: {form.dietary.map(id=>DIETARY_OPTIONS.find(d=>d.id===id)?.l||id).join(", ")}
      </div>}

      <InpF label="Must-Have Experiences (or leave to AI)" value={form.mustHaves} onChange={v=>upd("mustHaves",v)} rows={3} placeholder="e.g. Cave swim, Northern Lights, Cook a local dish, Sunset boat"/>
      <InpF label="Things to Avoid" value={form.avoid} onChange={v=>upd("avoid",v)} rows={2} placeholder="e.g. No extreme heights, No tourist traps, No overnight buses"/>
      <InpF label="Accessibility Needs" value={form.accessibility} onChange={v=>upd("accessibility",v)} placeholder="e.g. Wheelchair accessible, Elevator needed, Limited walking"/>
      <div className={s.extraChips}>
        {[{k:"petFriendly",i:"\u{1F43E}",l:"Pet-friendly stays"},{k:"workcation",i:"\u{1F4BB}",l:"Need WiFi & desk space"}].map(o=>(
          <Chip key={o.k} active={form[o.k]} onClick={()=>upd(o.k,!form[o.k])} icon={o.i} label={o.l}/>
        ))}
      </div>
    </>);

    case"review":{
      const nights=form.dateFrom&&form.dateTo?Math.round((new Date(form.dateTo)-new Date(form.dateFrom))/86400000):"?";
      const disabled=loading||!form.budget;
      return (<>
        <span className={s.title}>Ready to go</span>
        <span className={s.subtitle}>Your AI travel guide with interactive maps, images and live booking links is seconds away</span>
        <div className={s.reviewRows}>
          {[
            ["From",form.origin||"-"],
            ["To",form.destinations.length?form.destinations.join(", "):"AI will suggest"],
            ["Dates",form.dateFrom?`${form.dateFrom} to ${form.dateTo} (${nights}n)`:"Not set"],
            ["Group",`${form.adults} adults${form.children.length?`, ${form.children.length} children`:""} - ${form.groupDynamic}`],
            ["Budget",form.budget?`${form.currency} ${form.budget} ${({per_person:"per person",total:"total",per_day:"per day"})[form.budgetType]||form.budgetType}`:"Not set"],
            ["Vibe",form.tripTypes.slice(0,3).join(", ")||"General trip"],
            ...(form.occasions.length?[["Celebrating",form.occasions.map(id=>OCCASIONS.find(o=>o.id===id)?.l).join(", ")]]:[]),
            ...(form.dietary.length?[["Dietary",form.dietary.map(id=>DIETARY_OPTIONS.find(d=>d.id===id)?.l||id).join(", ")]]:[]),
            ...(form.selectedActivities.length?[["Must-Dos",form.selectedActivities.map(a=>a.label).slice(0,4).join(", ")+(form.selectedActivities.length>4?" + more":"")]]:[]),
          ].map(([k,v])=>(
            <div key={k} className={s.reviewRow}>
              <span className={s.reviewRowKey}>{k}</span>
              <span className={s.reviewRowVal}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={generate} disabled={disabled} className={disabled?s.generateBtnDisabled:s.generateBtnActive}>
          {loading?"Building your travel guide...":"Generate My Interactive Travel Guide"}
        </button>
        {!form.budget&&<div className={s.budgetWarning}>Go back to Step 5 to set your budget first</div>}
        {error&&<div className={s.errorBox}>{error}</div>}
      </>);
    }
    default: return null;
  }
}
