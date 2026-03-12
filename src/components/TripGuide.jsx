import { useState } from "react";
import { imgUrl, airbnbUrl, bookingUrl, mapsUrl, gygUrl, taUrl, viatorUrl, mapsRouteUrl, hotelsComUrl } from "../constants.js";
import { VBadge } from "./VBadge.jsx";
import { CurrencyToggle, convertPrice } from "./CurrencyToggle.jsx";
import { VerificationBar } from "./VerificationBar.jsx";
import { SafetyBadge } from "./SafetyBadge.jsx";
import { SeasonalPanel } from "./SeasonalPanel.jsx";
import { RatingBadge } from "./RatingBadge.jsx";
import { PdfExportButton } from "./PdfExport.jsx";
import s from "../styles/TripGuide.module.css";

// Color helpers for activity tags (dynamic per-tag)
const tC={free:{bg:"rgba(100,180,100,.15)",c:"#8ecf8e",b:"rgba(100,180,100,.25)"},paid:{bg:"rgba(212,168,67,.12)",c:"#d4a843",b:"rgba(212,168,67,.2)"},swim:{bg:"rgba(30,160,210,.12)",c:"#60c8e8",b:"rgba(30,160,210,.25)"},food:{bg:"rgba(210,90,60,.12)",c:"#e88870",b:"rgba(210,90,60,.25)"},culture:{bg:"rgba(150,100,210,.12)",c:"#c0a0e8",b:"rgba(150,100,210,.25)"},nature:{bg:"rgba(80,160,100,.12)",c:"#80c898",b:"rgba(80,160,100,.25)"},adventure:{bg:"rgba(210,120,30,.12)",c:"#e8a060",b:"rgba(210,120,30,.25)"}};
const tagStyle=t=>{const c=tC[t]||tC.paid;return{background:c.bg,color:c.c,border:`1px solid ${c.b}`};};

// Link-button helper: static class + dynamic color inline
const lBtnStyle=color=>({border:`1px solid ${color}30`,background:`${color}12`,color});

// ─── TRIP GUIDE ────────────────────────────────────────────────────────────
export function TripGuide({data,form,onReset,verification,verifying}){
  const [day,setDay]=useState(0);
  const [stay,setStay]=useState(0);
  const [tab,setTab]=useState("itinerary");
  const [localCurrency,setLocalCurrency]=useState(null);
  const maxN=Math.round(Number(form.budget||2000)*(form.adults||2)*0.35/(data.totalNights||7));
  const currencyRates=verification?.currency?.rates||{};
  const activeRate=localCurrency&&currencyRates[localCurrency]?currencyRates[localCurrency].rate:null;

  return(
    <div className={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* Hero */}
      <div className={s.hero}>
        <img src={imgUrl(data.heroKeyword,1600,900)} alt="" className={s.heroImg} onError={e=>{e.target.style.opacity=0;}}/>
        <div style={{position:"absolute",inset:0,background:`linear-gradient(to top,#080706 0%,${(data.heroGradient||"#080706").split(",")[0]}90 30%,transparent 100%)`}}/>
        <div className={s.heroContent}>
          <div className={s.heroBadge}>{data.origin} to {data.primaryDestination}</div>
          <h1 className={s.heroTitle}>{data.tripTitle}</h1>
          <p className={s.heroTagline}>{data.tagline}</p>
          <div className={s.heroStats}>
            {[["\u{1F4C5}",`${data.checkIn||"TBD"} - ${data.checkOut||"TBD"}`],["\u{1F465}",`${data.adults} adults${data.children>0?`, ${data.children} kids`:""}`],["\u{1F319}",`${data.totalNights}n`],["\u{1F4B0}",`${data.currency} ${Number(data.budget?.perPerson||0).toLocaleString()}/pp est.`]].map(([i,t])=>(
              <div key={t} className={s.heroStat}>{i} {t}</div>
            ))}
            {verification?.safety?.[data.primaryDestination]&&<SafetyBadge safety={verification.safety[data.primaryDestination]} inline/>}
          </div>
          <div className={s.heroCtas}>
            <a href={mapsRouteUrl(data.origin,data.routeDestinations||data.allDestinations||[])} target="_blank" rel="noreferrer" className={s.heroMapBtn}>
              {"\uD83D\uDDFA\uFE0F"} View Complete Route on Google Maps
            </a>
            <button onClick={()=>setTab("suggestions")} className={s.heroSugBtn}>
              {"\u2728"} Can't-Miss Experiences
            </button>
            <PdfExportButton data={data} verification={verification}/>
          </div>
        </div>
        <button onClick={onReset} className={s.newTripBtn}>New Trip</button>
      </div>

      {/* Summary */}
      <div className={s.summaryBar}>
        <div className={s.summaryText}>{data.summary}</div>
      </div>

      {/* Nav */}
      <div className={s.nav}>
        <div className={s.navInner}>
          {[{id:"map",l:"\uD83D\uDDFA\uFE0F Route Map"},{id:"itinerary",l:"Itinerary"},{id:"stays",l:"Stays"},{id:"flights",l:"Flights"},{id:"budget",l:"Budget"},{id:"suggestions",l:"\u2728 Suggestions"},{id:"tips",l:"Tips"}].map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} className={tab===n.id?s.navBtnActive:s.navBtnInactive}>{n.l}</button>
          ))}
        </div>
      </div>
      <VerificationBar verification={verification} verifying={verifying}/>

      <div className={s.content}>

        {/* ROUTE MAP */}
        {tab==="map"&&<div>
          <div className={s.sectionTitle}>Your Travel Route</div>
          <div className={s.sectionSub}>{data.origin} {(data.routeDestinations||data.allDestinations||[]).map(d=>" \u2192 "+d).join("")}</div>
          <div className={s.mapFrame}>
            <iframe
              title="Travel Route Map"
              width="100%"
              height="500"
              style={{border:0}}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/directions?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&origin=${encodeURIComponent(data.origin||"")}&destination=${encodeURIComponent((data.routeDestinations||data.allDestinations||[]).slice(-1)[0]||"")}&waypoints=${(data.routeDestinations||data.allDestinations||[]).slice(0,-1).map(d=>encodeURIComponent(d)).join("|")}&mode=flying`}
            />
          </div>
          <div className={s.mapBtns}>
            <a href={mapsRouteUrl(data.origin,data.routeDestinations||data.allDestinations||[])} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"linear-gradient(135deg,#4285F4,#34A853)",padding:"12px 22px",fontSize:13}}>
              Open Full Route in Google Maps
            </a>
          </div>
          <div className={s.routeStops}>
            <div className={s.routeStopsLabel}>Route Stops</div>
            {[data.origin,...(data.routeDestinations||data.allDestinations||[])].filter(Boolean).map((stop,i,arr)=>(
              <div key={i} className={s.routeStop}>
                <div className={s.routeStopNum} style={{background:i===0?"rgba(76,175,142,.15)":i===arr.length-1?"rgba(232,112,112,.15)":"rgba(212,168,67,.12)",border:i===0?"1.5px solid rgba(76,175,142,.4)":i===arr.length-1?"1.5px solid rgba(232,112,112,.4)":"1.5px solid rgba(212,168,67,.35)",color:i===0?"#4caf8e":i===arr.length-1?"#e87070":"#d4a843"}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div className={s.routeStopName}>{stop}</div>
                  <div className={s.routeStopType}>{i===0?"Starting point":i===arr.length-1?"Final destination":"Stopover"}</div>
                </div>
                <a href={mapsUrl(stop)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#4285F4")}>View on Maps</a>
              </div>
            ))}
          </div>
        </div>}

        {/* ITINERARY */}
        {tab==="itinerary"&&<div>
          <div className={s.tabRow}>
            {(data.days||[]).map((d,i)=>(
              <button key={i} onClick={()=>setDay(i)} className={day===i?s.tabBtnActive:s.tabBtnInactive}>Day {d.dayNum}</button>
            ))}
          </div>
          {data.days?.[day]&&(()=>{const d=data.days[day];return(
            <div className={s.dayGrid}>
              <div>
                <div className={s.dayCard}>
                  <div className={s.dayHero}>
                    <img src={imgUrl(d.imageKeyword,900,400)} alt={d.location} className={s.dayHeroImg} onError={e=>{e.target.src=imgUrl(data.heroKeyword,900,400);}}/>
                    <div className={s.dayHeroOverlay}/>
                    <div className={s.dayHeroInfo}>
                      <div className={s.dayNum}>Day {d.dayNum}</div>
                      <div className={s.dayDate}>{d.date} - {d.location}</div>
                    </div>
                    <div className={s.dayBadges}>
                      <div className={s.dayTheme}>{d.theme}</div>
                      {verification?.weather?.[d.location]&&(()=>{const wd=verification.weather[d.location];const dd=wd?.days?.find(w=>d.date&&w.date&&d.date.includes(w.date.split("-").pop()));return dd?<div className={s.dayWeatherBadge}><span>{dd.icon}</span><span>{Math.round(dd.temp_high)}\u00B0</span></div>:null;})()}
                    </div>
                  </div>
                  <div className={s.activities}>
                    {(d.activities||[]).map((a,i)=>(
                      <div key={i} className={i<d.activities.length-1?s.activityBorder:s.activity}>
                        <div className={s.actTime}>{a.time}</div>
                        <div className={s.actBody}>
                          <div className={s.actName}>
                            {a.name}
                            {(()=>{const rv=verification?.reviews?.find(r=>r.place_name===a.name);return rv?<RatingBadge review={rv}/>:null;})()}
                            {a.tag&&<span className={s.actTag} style={tagStyle(a.tag)}>{a.tag}</span>}
                            {a.costPP&&a.costPP.toLowerCase()!=="free"&&<span className={s.actCost}>{activeRate?`${localCurrency} ${convertPrice(a.costPP.replace(/[^0-9.]/g,""),activeRate)}`:a.costPP}{a.costPP.includes("/pp")?"":"/pp"}</span>}
                            {a.costPP&&a.costPP.toLowerCase()==="free"&&<span className={s.actTag} style={tagStyle("free")}>Free</span>}
                            {(()=>{const va=verification?.activities?.find(v=>v.matched_activity&&a.bookingKeyword&&v.matched_activity.toLowerCase().includes(a.bookingKeyword?.toLowerCase()?.slice(0,15)));return va&&va.price?<VBadge type="verified" label={`${data.currency} ${va.price} on ${va.source}`} small/>:verification&&!verifying?<VBadge type="ai" small/>:null;})()}
                          </div>
                          <div className={s.actDesc}>{a.description}</div>
                          <div className={s.actLinks}>
                            {a.mapsQuery&&<a href={mapsUrl(a.mapsQuery)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#1a9ebe")}>Maps</a>}
                            {a.bookingKeyword&&<a href={gygUrl(a.bookingKeyword,d.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#d4a843")}>GetYourGuide</a>}
                            {a.bookingKeyword&&<a href={viatorUrl(a.bookingKeyword+" "+d.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#2a8c4a")}>Viator</a>}
                            {a.bookingKeyword&&<a href={taUrl(a.name+" "+d.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#555")}>Reviews</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {d.diningTip&&<div className={s.diningTip}>
                  <span className={s.diningEmoji}>{"\uD83C\uDF7D\uFE0F"}</span>
                  <div className={s.diningContent}>
                    <div className={s.diningHeader}>
                      <span className={s.diningName}>{d.diningTip.name}</span>
                      {(()=>{const rv=verification?.reviews?.find(r=>r.place_name===d.diningTip.name);return rv?<RatingBadge review={rv}/>:null;})()}
                      {(()=>{const pv=verification?.places?.find(p=>p.query===d.diningTip.name);return pv?<VBadge type={pv.found?"verified":"failed"} small/>:null;})()}
                    </div>
                    <div className={s.diningDesc}>{d.diningTip.description}</div>
                    <div className={s.diningLinks}>
                      <a href={mapsUrl(d.diningTip.mapsQuery)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#e88870")}>Find on Maps</a>
                      {(()=>{const pv=verification?.places?.find(p=>p.query===d.diningTip.name&&p.found&&p.maps_url);return pv?<a href={pv.maps_url} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#4caf8e")}>Verified Location</a>:null;})()}
                    </div>
                  </div>
                </div>}
              </div>
              <div className={s.sidebar}>
                {/* Weather for this day */}
                {verification?.weather?.[d.location]&&(()=>{const wd=verification.weather[d.location];const match=wd?.days?.[day];return match?<div className={s.weatherCard}>
                  <div className={s.weatherLabel}>Weather Forecast</div>
                  <div className={s.weatherRow}>
                    <span className={s.weatherIcon}>{match.icon}</span>
                    <div>
                      <div className={s.weatherTemp}>{Math.round(match.temp_high)}\u00B0 / {Math.round(match.temp_low)}\u00B0</div>
                      <div className={s.weatherDesc}>{match.description}</div>
                      {match.precipitation_chance>15&&<div className={s.weatherRain}>{"\uD83C\uDF27\uFE0F"} {match.precipitation_chance}% chance of rain</div>}
                    </div>
                  </div>
                </div>:null;})()}
                {verification?.safety?.[d.location]&&<SafetyBadge safety={verification.safety[d.location]}/>}
                {verification?.seasonal?.[d.location]&&<SeasonalPanel seasonal={verification.seasonal[d.location]}/>}
                <div className={s.stayCard}>
                  <div className={s.stayHeader}>
                    <div className={s.stayLabel}>Tonight's Stay</div>
                    <div className={s.stayLocation}>{d.location}</div>
                  </div>
                  <div className={s.stayLinks}>
                    <a href={airbnbUrl(d.location,data.checkIn,data.checkOut,data.adults,data.children,maxN)} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"linear-gradient(135deg,#FF385C,#e8264a)",justifyContent:"center",fontSize:12}}>Airbnb</a>
                    <a href={bookingUrl(d.location,data.checkIn,data.checkOut,data.adults)} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"rgba(0,100,200,.85)",justifyContent:"center",fontSize:12}}>Booking.com</a>
                    <a href={`https://www.google.com/travel/hotels/${encodeURIComponent(d.location)}`} target="_blank" rel="noreferrer" className={s.googleHotelLink}>Google Hotels</a>
                  </div>
                </div>
                <div className={s.dayNavBtns}>
                  {day>0&&<button onClick={()=>setDay(d=>d-1)} className={s.dayNavBtn}>Day {day}</button>}
                  {day<(data.days?.length||1)-1&&<button onClick={()=>setDay(d=>d+1)} className={s.dayNavBtn}>Day {day+2}</button>}
                </div>
              </div>
            </div>
          );})()}
        </div>}

        {/* STAYS */}
        {tab==="stays"&&<div>
          <div className={s.tabRow} style={{marginBottom:20}}>
            {(data.accommodations||[]).map((st,i)=><button key={i} onClick={()=>setStay(i)} className={stay===i?s.tabBtnActive:s.tabBtnInactive}>{st.location} - {st.nights}n</button>)}
          </div>
          {data.accommodations?.[stay]&&(()=>{const st=data.accommodations[stay];return(<div>
            <div className={s.locationWrap}><div className={s.locationTitle}>{st.location}</div><div className={s.locationDates}>{st.checkIn} - {st.checkOut} - {st.nights} nights</div></div>
            <div className={s.staySearchBox}>
              <div className={s.staySearchLabel}>Search Real Availability & Current Prices</div>
              <div className={s.staySearchBtns}>
                <a href={airbnbUrl(st.location,st.checkIn||data.checkIn,st.checkOut||data.checkOut,data.adults,data.children,maxN)} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"linear-gradient(135deg,#FF385C,#e8264a)"}}>Airbnb</a>
                <a href={bookingUrl(st.location,st.checkIn||data.checkIn,st.checkOut||data.checkOut,data.adults)} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"rgba(0,100,200,.9)"}}>Booking.com</a>
                <a href={hotelsComUrl(st.location,st.checkIn||data.checkIn,st.checkOut||data.checkOut,data.adults)} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"rgba(211,47,47,.85)"}}>Hotels.com</a>
                <a href={`https://www.google.com/travel/hotels/${encodeURIComponent(st.location)}?q=${encodeURIComponent(st.location)}&g2lb=2502548,2503771&hl=en&gl=us&cs=1&ssta=1&ts=CAESCgoCCAMKAggDEAAaRwopEicyJTB4MTQ3NjY4ZGVmY2M0OTI5YjoxLCoyJTB4MTQ3NjY4ZGVmYWU2&checkin=${st.checkIn||data.checkIn||""}&checkout=${st.checkOut||data.checkOut||""}&ap=MAA`} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:"rgba(66,133,244,.85)"}}>Google Hotels</a>
              </div>
            </div>
            {/* Verified Hotels */}
            {verification?.hotels?.[st.location]?.length>0&&<div className={s.verifiedHotels}>
              <div className={s.verifiedHotelsHeader}>
                <VBadge type="verified" label="Real Prices from Web"/>
                <span className={s.verifiedHotelsCount}>{verification.hotels[st.location].length} hotels found</span>
              </div>
              <div className={s.hotelGrid}>
                {verification.hotels[st.location].slice(0,6).map((h,i)=>(
                  <div key={i} className={s.hotelCard}>
                    <div className={s.hotelName}>{h.name}</div>
                    <div className={s.hotelPriceRow}>
                      {h.price_per_night&&<span className={s.hotelPrice}>{activeRate?`${localCurrency} ${convertPrice(h.price_per_night,activeRate)}`:`${h.currency} ${h.price_per_night}`}<span className={s.hotelPriceUnit}>/night</span></span>}
                      {h.rating&&<span className={s.hotelRating}>{"\u2605"} {h.rating}{h.review_count?` (${h.review_count})`:""}</span>}
                    </div>
                    <div className={s.hotelMeta}>
                      <span className={s.hotelSource}>via {h.source}</span>
                      {h.booking_url&&<a href={h.booking_url} target="_blank" rel="noreferrer" className={s.hotelBookLink}>Book</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>}

            <div className={s.aiLabel}>AI Recommended Options</div>
            <div className={s.optGrid}>
              {(st.options||[]).map((opt,i)=>(
                <div key={i} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}} className={i===0?s.optCardPrimary:s.optCardSecondary}>
                  <div className={s.optHero}>
                    <img src={imgUrl(opt.imageKeyword||st.location+" hotel",600,260)} alt={opt.name} className={s.optHeroImg} onError={e=>{e.target.src=imgUrl(st.location+" accommodation",600,260);}}/>
                    <div className={i===0?s.optLabelPrimary:s.optLabelSecondary}>{opt.label}</div>
                  </div>
                  <div className={s.optBody}>
                    <div className={s.optName}>{opt.name}</div>
                    <div className={s.optType}>{opt.type} - {opt.neighborhood}</div>
                    <div className={s.optDesc}>{opt.description}</div>
                    {opt.amenities?.length>0&&<div className={s.optAmenities}>{opt.amenities.map(a=><span key={a} className={s.optAmenity}>{a}</span>)}</div>}
                    <div className={s.optFooter}>
                      <div><span className={s.optPrice}>{opt.pricePerNight}</span><span className={s.optPriceUnit}>/night</span></div>
                      <div className={s.optBookBtns}>
                        <a href={airbnbUrl(st.location,st.checkIn||data.checkIn,st.checkOut||data.checkOut,data.adults,data.children,maxN)} target="_blank" rel="noreferrer" className={s.optBookAirbnb}>Airbnb</a>
                        <a href={bookingUrl(st.location,st.checkIn||data.checkIn,st.checkOut||data.checkOut,data.adults)} target="_blank" rel="noreferrer" className={s.optBookBooking}>Booking</a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>);})()}
        </div>}

        {/* FLIGHTS */}
        {tab==="flights"&&<div>
          <div className={s.sectionTitle}>Flights</div>
          <div className={s.sectionSub}>{data.origin} to {data.primaryDestination} - {data.checkIn} to {data.checkOut}</div>
          <div className={s.flightSearchBtns}>
            {[{l:"Google Flights",bg:"#1a73e8",u:`https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(data.origin||"")}+to+${encodeURIComponent(data.primaryDestination||"")}`},{l:"Skyscanner",bg:"#00A698",u:"https://www.skyscanner.com"},{l:"KAYAK",bg:"#FF690F",u:`https://www.kayak.com/flights/${encodeURIComponent(data.origin||"")}-${encodeURIComponent(data.primaryDestination||"")}/${data.checkIn||""}/${data.checkOut||""}/${data.adults}adults`}].map(fl=>(
              <a key={fl.l} href={fl.u} target="_blank" rel="noreferrer" className={s.bigBtn} style={{background:fl.bg,padding:"10px 18px"}}>{fl.l}</a>
            ))}
          </div>
          {/* Verified Flights */}
          {verification?.flights?.length>0&&verification.flights[0].source!=="Search Links"&&<div className={s.verifiedFlights}>
            <div className={s.verifiedFlightsHeader}>
              <VBadge type="verified" label="Real Flight Prices"/>
              <span className={s.verifiedHotelsCount}>{verification.flights.length} options found</span>
            </div>
            <div className={s.vfGrid}>
              {verification.flights.slice(0,4).map((vf,i)=>(
                <div key={i} className={s.vfCard}>
                  <div className={s.vfAirline}>{vf.airline}</div>
                  {vf.price&&<div className={s.vfPrice}>{activeRate?`${localCurrency} ${convertPrice(vf.price,activeRate)}`:`${vf.currency} ${vf.price}`}/pp</div>}
                  <div className={s.vfMeta}>
                    {vf.duration&&<span className={s.vfMetaItem}>{vf.duration}</span>}
                    {vf.stops>=0&&<span className={s.vfMetaItem}>{vf.stops===0?"Nonstop":`${vf.stops} stop${vf.stops>1?"s":""}`}</span>}
                  </div>
                  {vf.booking_url&&<a href={vf.booking_url} target="_blank" rel="noreferrer" className={s.vfBookBtn}>View on {vf.source}</a>}
                </div>
              ))}
            </div>
          </div>}

          <div className={s.aiLabel}>AI Estimated Flights</div>
          <div className={s.optGrid}>
            {(data.flights||[]).map((fl,i)=>(
              <div key={i} className={i===0?s.flightCardPrimary:s.flightCardSecondary}>
                {i===0&&<div className={s.flightLabel}>{fl.label}</div>}
                <div className={s.flightAirline}>{fl.airline}</div>
                <div className={s.flightRoute}>{fl.route}</div>
                {[["Stops",fl.stops],["Duration",fl.duration],["Est. Price",fl.estimatedPrice]].map(([k,v])=>(
                  <div key={k} className={s.flightRow}>
                    <span className={s.flightRowKey}>{k}</span><span className={k==="Est. Price"?s.flightRowPrice:s.flightRowVal}>{v}</span>
                  </div>
                ))}
                {fl.tip&&<div className={s.flightTip}>{fl.tip}</div>}
                <a href={`https://www.google.com/travel/flights?q=${encodeURIComponent(fl.searchQuery||"")}`} target="_blank" rel="noreferrer" className={s.flightSearchBtn}>Search This Route</a>
              </div>
            ))}
          </div>
          {data.bookingOrder?.length>0&&<div className={s.bookingOrder}>
            <div className={s.bookingOrderTitle}>Book in This Order</div>
            <ol className={s.bookingOrderList}>{data.bookingOrder.map((item,i)=><li key={i} className={s.bookingOrderItem}>{item}</li>)}</ol>
          </div>}
        </div>}

        {/* BUDGET */}
        {tab==="budget"&&data.budget&&<div>
          <div className={s.budgetHeader}>
            <div className={s.sectionTitle}>Budget Breakdown</div>
            <CurrencyToggle rates={currencyRates} baseCurrency={data.currency} showLocal={localCurrency} onToggle={setLocalCurrency}/>
          </div>
          {verification?.currency&&!verification.currency.error&&<div className={s.liveRates}>
            <VBadge type="verified" label="Live Exchange Rates"/>
            {Object.entries(currencyRates).map(([cur,info])=>(
              <span key={cur} className={s.rateItem}>1 {data.currency} = <span className={s.rateVal}>{info.rate?.toFixed(2)} {cur}</span></span>
            ))}
          </div>}
          <div className={s.budgetSummary}>
            {[["Total",activeRate?`${localCurrency} ${convertPrice(data.budget.totalEstimate,activeRate).toLocaleString()}`:`${data.currency} ${Number(data.budget.totalEstimate||0).toLocaleString()}`],["Per Person",activeRate?`${localCurrency} ${convertPrice(data.budget.perPerson,activeRate).toLocaleString()}`:`${data.currency} ${Number(data.budget.perPerson||0).toLocaleString()}`],["Per Night/pp",activeRate?`${localCurrency} ${convertPrice(Math.round(Number(data.budget.perPerson||0)/(data.totalNights||1)),activeRate).toLocaleString()}`:`${data.currency} ${Math.round(Number(data.budget.perPerson||0)/(data.totalNights||1)).toLocaleString()}`]].map(([l,v])=>(
              <div key={l} className={s.budgetBox}>
                <div className={s.budgetBoxLabel}>{l}</div>
                <div className={s.budgetBoxVal}>{v}</div>
              </div>
            ))}
          </div>
          <div className={s.budgetTable}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"rgba(212,168,67,.07)",borderBottom:"1px solid rgba(255,255,255,.08)"}}>{["Category","Total","Per Person","Tip"].map(h=><th key={h} className={s.budgetTh}>{h}</th>)}</tr></thead>
              <tbody>{(data.budget.breakdown||[]).map((row,i)=>(
                <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <td className={s.budgetTdCat}>{row.category}</td>
                  <td className={s.budgetTdTotal}>{data.currency} {Number(row.total||0).toLocaleString()}</td>
                  <td className={s.budgetTdPp}>{data.currency} {Number(row.perPerson||0).toLocaleString()}</td>
                  <td className={s.budgetTdTip}>{row.tip}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>}

        {/* SUGGESTIONS */}
        {tab==="suggestions"&&<div>
          <div className={s.sectionTitle}>Can't-Miss Experiences</div>
          <div className={s.sectionSub} style={{marginBottom:8}}>These may stretch your budget, but they're once-in-a-lifetime experiences worth considering</div>
          <div className={s.sugInfo}>
            <span className={s.sugInfoIcon}>{"\u{1F4A1}"}</span>
            <span className={s.sugInfoText}>These are premium suggestions outside your main budget. Prices are real-world estimates — click the booking links to check current availability and exact pricing.</span>
          </div>
          {(data.suggestedSplurges||[]).length===0&&(
            <div className={s.sugEmpty}>No splurge suggestions were generated for this trip. Try regenerating!</div>
          )}
          <div className={s.sugGrid}>
            {(data.suggestedSplurges||[]).map((sp,i)=>(
              <div key={i} className={s.sugCard}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}>
                <div className={s.sugHero}>
                  <img src={imgUrl(sp.name+" "+sp.location,700,300)} alt={sp.name} className={s.sugHeroImg} onError={e=>{e.target.style.opacity=0;}}/>
                  <div className={s.sugHeroOverlay}/>
                  <div className={s.sugCat}>{sp.category||"Premium"}</div>
                  <div className={s.sugCost}>{sp.estimatedCost}</div>
                  <div className={s.sugHeroInfo}>
                    <div className={s.sugName}>{sp.name}</div>
                    <div className={s.sugLocation}>{sp.location}</div>
                  </div>
                </div>
                <div className={s.sugBody}>
                  <div className={s.sugDesc}>{sp.description}</div>
                  {sp.whySpecial&&<div className={s.sugWhy}>{sp.whySpecial}</div>}
                  <div className={s.sugLinks}>
                    {sp.mapsQuery&&<a href={mapsUrl(sp.mapsQuery)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#1a9ebe")}>Maps</a>}
                    {sp.bookingKeyword&&<a href={gygUrl(sp.bookingKeyword,sp.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#d4a843")}>GetYourGuide</a>}
                    {sp.bookingKeyword&&<a href={viatorUrl(sp.bookingKeyword+" "+sp.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#2a8c4a")}>Viator</a>}
                    {sp.bookingKeyword&&<a href={taUrl(sp.name+" "+sp.location)} target="_blank" rel="noreferrer" className={s.linkBtn} style={lBtnStyle("#555")}>Reviews</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* TIPS */}
        {tab==="tips"&&<div>
          <div className={s.sectionTitle} style={{marginBottom:24}}>Insider Tips & Inspiration</div>
          <div className={s.tipsGrid}>
            {(data.insiderTips||[]).map((tip,i)=><div key={i} className={s.tipCard}><div className={s.tipText}>{tip}</div></div>)}
          </div>
          {data.packingHighlights?.length>0&&<div className={s.packingBox}>
            <div className={s.packingTitle}>Pack This</div>
            <div className={s.packingItems}>{data.packingHighlights.map(p=><span key={p} className={s.packingItem}>{p}</span>)}</div>
          </div>}
          <div className={s.socialGrid}>
            {data.instagramAccounts?.length>0&&<div className={s.socialBox}>
              <div className={s.socialTitle}>Follow for Inspo</div>
              {data.instagramAccounts.map(a=><a key={a.handle} href={`https://instagram.com/${a.handle.replace("@","")}`} target="_blank" rel="noreferrer" className={s.igLink}>
                <span className={s.igAt}>@</span>
                <div><div className={s.igHandle}>{a.handle}</div><div className={s.igDesc}>{a.description}</div></div>
              </a>)}
            </div>}
            {data.youtubeSearches?.length>0&&<div className={s.socialBox}>
              <div className={s.socialTitle}>Watch Before You Go</div>
              {data.youtubeSearches.map(q=><a key={q} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer" className={s.ytLink}>
                <span className={s.ytIcon}>play</span>{q}
              </a>)}
            </div>}
          </div>
        </div>}
      </div>
      <div className={s.footer}>
        TripMind v2 — AI Trip Planning + Real-Time Verification
        {verification&&<span> — {verification.agent_statuses?.filter(st=>st.status==="success").length||0} agents verified your trip</span>}
        {!verification&&" — All links open real booking platforms with your dates pre-filled"}
      </div>
    </div>
  );
}
