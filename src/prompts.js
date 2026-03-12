import { DIETARY_OPTIONS } from "./constants.js";

// ─── PROMPT BUILDERS (Split: Skeleton + Days) ──────────────────────────────

function _tripParams(f,nights,ppB,maxN){
  const actLabels=f.selectedActivities.map(a=>a.label).join(", ");
  const occasions=f.occasions.join(", ");
  const dietary=f.dietary.map(id=>DIETARY_OPTIONS.find(d=>d.id===id)?.l||id).join(", ");
  return`- From: ${f.origin||"Chicago, IL"}, Passport: ${f.passportCountry||"US"}
- To: ${f.destinations.length?f.destinations.join(", "):"suggest best destination based on preferences"}
- Dates: ${f.dateFrom||"flexible"} to ${f.dateTo||"flexible"} (${nights} nights, flexibility: ${f.dateFlexibility})
- Group: ${f.adults} adults${f.children.length?`, children ages: ${f.children.join(",")}`:""}
- Dynamic: ${f.groupDynamic}, Occasions: ${occasions||"fun trip"}
- Budget: ${f.currency} ${f.budget} ${f.budgetType} (${f.budgetFlexibility}), max nightly accommodation: ${f.currency} ${maxN}
- Trip vibes: ${f.tripTypes.join(", ")||"general"}
- MUST-DO activities: ${actLabels||"traveler's choice - suggest best"}
- Activity level: ${f.activityLevel}, Style: ${f.travelStyle}
- Accommodation: ${f.accommodation.join(", ")||"mid-range to boutique"}
- Dietary: ${dietary||"none"}
- Must-haves: ${f.mustHaves||"best of the destination"}
- Avoid: ${f.avoid||"nothing specific"}
- Accessibility: ${f.accessibility||"none"}
- Pet-friendly: ${f.petFriendly?"YES":"No"}
- Climate preference: ${f.climate||"any"}
- Workcation (WiFi/desk needed): ${f.workcation?"YES":"No"}`;
}

// CALL 1: Everything except detailed days — budget, flights, stays, tips, splurges, day outline
export function buildSkeletonPrompt(f){
  const nights=f.dateFrom&&f.dateTo?Math.round((new Date(f.dateTo)-new Date(f.dateFrom))/86400000):7;
  const ppB=f.budgetType==="per_person"?Number(f.budget):f.budgetType==="total"?Math.round(Number(f.budget)/(f.adults||1)):Number(f.budget)*nights;
  const maxN=Math.round(ppB*(f.adults||2)*0.35/nights);

  return`You are a world-class travel planner. Create a trip plan SKELETON as raw valid JSON only - no markdown, no backticks.
This is PART 1 of 2. Generate everything EXCEPT detailed daily activities. Include a brief "dayOutline" instead of full "days".

TRIP PARAMETERS:
${_tripParams(f,nights,ppB,maxN)}

CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No text before or after.
Do NOT include a detailed "days" array. Instead include "dayOutline" with brief entries.
Use realistic price RANGES. Flag any cost exceeding ${Math.round(ppB/nights*0.4)} ${f.currency}/pp.

{
  "tripTitle":"Evocative 4-6 word title",
  "tagline":"One sentence soul of this trip",
  "heroKeyword":"unsplash keyword",
  "heroGradient":"#1a0a2e,#0d1a3a",
  "summary":"2-3 sentences why perfect for these travelers",
  "totalNights":${nights},
  "origin":"${f.origin||"Chicago"}",
  "primaryDestination":"main city/country",
  "allDestinations":["city1","city2"],
  "checkIn":"${f.dateFrom||""}",
  "checkOut":"${f.dateTo||""}",
  "adults":${f.adults},
  "children":${f.children.length},
  "currency":"${f.currency}",
  "routeDestinations":["City1, Country","City2, Country"],
  "budget":{
    "totalEstimate":"8400","perPerson":"1400",
    "breakdown":[
      {"category":"Flights","total":"2400","perPerson":"400","tip":"book 6+ weeks out"},
      {"category":"Accommodation","total":"2100","perPerson":"350","tip":"..."},
      {"category":"Activities","total":"900","perPerson":"150","tip":"..."},
      {"category":"Food & Dining","total":"1200","perPerson":"200","tip":"..."},
      {"category":"Local Transport","total":"480","perPerson":"80","tip":"..."},
      {"category":"Misc & Tips","total":"360","perPerson":"60","tip":"..."},
      {"category":"Buffer 10%","total":"700","perPerson":"120","tip":"always recommended"}
    ]
  },
  "flights":[
    {"option":1,"label":"Best Value","airline":"Name","route":"ORD to FCO","stops":"1 stop via LHR","duration":"10h","estimatedPrice":"${f.currency} 450-600/pp","tip":"booking tip","searchQuery":"flights from ${f.origin||"Chicago"} to DEST"},
    {"option":2,"label":"Fastest","airline":"...","route":"...","stops":"...","duration":"...","estimatedPrice":"...","tip":"...","searchQuery":"..."}
  ],
  "insiderTips":["tip1","tip2","tip3","tip4","tip5"],
  "packingHighlights":["item1","item2","item3","item4","item5","item6"],
  "instagramAccounts":[{"handle":"@account","description":"why follow"}],
  "youtubeSearches":["search term 1","search term 2","search term 3"],
  "suggestedSplurges":[
    {"name":"Premium activity","description":"1 sentence why unmissable","estimatedCost":"${f.currency} range/pp","category":"Adventure|Culture|Food|Nature|Wellness|Nightlife","bookingKeyword":"specific query","location":"City, Country","whySpecial":"1 sentence","mapsQuery":"google maps search"}
  ],
  "bookingOrder":["1. ...","2. ...","3. ...","4. ...","5. ..."],
  "accommodations":[
    {
      "location":"City","checkIn":"date","checkOut":"date","nights":2,
      "options":[
        {"rank":1,"label":"Top Pick","name":"Area/property","type":"Airbnb/Hotel","neighborhood":"area","description":"1-2 sentences","pricePerNight":"${f.currency} amount","amenities":["WiFi","Pool"],"imageKeyword":"keyword"},
        {"rank":2,"label":"Value Pick","name":"...","type":"...","neighborhood":"...","description":"...","pricePerNight":"...","amenities":[],"imageKeyword":"..."},
        {"rank":3,"label":"Splurge","name":"...","type":"...","neighborhood":"...","description":"...","pricePerNight":"...","amenities":[],"imageKeyword":"..."}
      ]
    }
  ],
  "dayOutline":[
    {"dayNum":1,"date":"e.g. July 12, Sat","location":"City, Country","theme":"short evocative theme"}
  ]
}`;
}

// CALL 2: Full day-by-day itinerary with activities and dining
export function buildDaysPrompt(skeleton,f){
  const nights=skeleton.totalNights||7;
  const ppB=f.budgetType==="per_person"?Number(f.budget):f.budgetType==="total"?Math.round(Number(f.budget)/(f.adults||1)):Number(f.budget)*nights;
  const dietary=f.dietary.map(id=>DIETARY_OPTIONS.find(d=>d.id===id)?.l||id).join(", ");
  const dailyBudget=Math.round((Number(skeleton.budget?.perPerson||ppB))/nights*0.3);

  return`You are a world-class travel planner. Generate the DETAILED DAY-BY-DAY itinerary as raw valid JSON only.
This is PART 2 of 2. The trip skeleton exists. Now fill in full daily activities.

TRIP CONTEXT:
- Title: ${skeleton.tripTitle}
- Destinations: ${(skeleton.allDestinations||[]).join(", ")}
- Dates: ${skeleton.checkIn} to ${skeleton.checkOut} (${nights} nights)
- Group: ${skeleton.adults} adults${skeleton.children>0?`, ${skeleton.children} kids`:""}
- Budget per person: ${skeleton.currency} ${skeleton.budget?.perPerson||ppB}
- Daily activity budget: ~${skeleton.currency} ${dailyBudget}/pp
- Dietary: ${dietary||"none"}
- Activity level: ${f.activityLevel}, Style: ${f.travelStyle}
- Must-haves: ${f.mustHaves||"best of the destination"}
- Avoid: ${f.avoid||"nothing specific"}
- Accessibility: ${f.accessibility||"none"}
- Climate preference: ${f.climate||"any"}
- Workcation: ${f.workcation?"YES - suggest morning work blocks & coworking cafes":"No"}

DAY OUTLINE (match these exactly):
${JSON.stringify(skeleton.dayOutline||[],null,1)}

ACCOMMODATIONS (for context):
${(skeleton.accommodations||[]).map(a=>`${a.location}: ${a.checkIn} to ${a.checkOut}`).join("\n")}

CRITICAL: Return ONLY valid JSON: {"days":[...]}. No markdown. No backticks.
You MUST generate ALL ${nights} days. Do not skip any.
Keep activity descriptions to 1 SHORT sentence. Keep dining tips to 1 sentence.
Match the dayOutline above exactly for dayNum, date, location, and theme.
3-4 activities per day. One diningTip per day.
Use realistic price RANGES. "bookingKeyword": specific GetYourGuide/Viator query. "mapsQuery": real place + city.

{
  "days":[
    {
      "dayNum":1,"date":"from outline","location":"from outline",
      "theme":"from outline",
      "imageKeyword":"specific unsplash keyword",
      "activities":[
        {"time":"Morning","name":"Real specific activity","description":"1 sentence insider detail.","costPP":"Free / $20","tag":"free|paid|swim|food|culture|nature|adventure","mapsQuery":"exact google maps query","bookingKeyword":"GetYourGuide keyword or empty"}
      ],
      "diningTip":{"name":"Real restaurant name","description":"What to order, 1 sentence","mapsQuery":"restaurant name city"}
    }
  ]
}`;
}
