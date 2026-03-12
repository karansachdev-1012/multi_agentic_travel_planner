// ─── CONSTANTS ─────────────────────────────────────────────────────────────
export const TRIP_TYPES = [
  {id:"beach",l:"Beach & Sun",i:"\u{1F3D6}\u{FE0F}"},{id:"adventure",l:"Adventure",i:"\u{1F9D7}"},
  {id:"cultural",l:"Culture & History",i:"\u{1F3DB}\u{FE0F}"},{id:"food",l:"Food & Wine",i:"\u{1F377}"},
  {id:"nature",l:"Nature & Wildlife",i:"\u{1F981}"},{id:"romance",l:"Romance",i:"\u{1F491}"},
  {id:"family",l:"Family Fun",i:"\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}"},{id:"nightlife",l:"Nightlife",i:"\u{1F389}"},
  {id:"wellness",l:"Wellness & Spa",i:"\u{1F9D8}"},{id:"skiing",l:"Ski & Snow",i:"\u{26F7}\u{FE0F}"},
  {id:"roadtrip",l:"Road Trip",i:"\u{1F697}"},{id:"luxury",l:"Luxury",i:"\u{1F48E}"},
  {id:"backpacker",l:"Backpacker",i:"\u{1F392}"},{id:"photography",l:"Photography",i:"\u{1F4F8}"},
  {id:"diving",l:"Diving & Snorkel",i:"\u{1F93F}"},{id:"hiking",l:"Hiking & Trekking",i:"\u{1F97E}"},
];

export const OCCASIONS = [
  {id:"birthday",i:"\u{1F382}",l:"Birthday"},
  {id:"milestone_30",i:"3\u{FE0F}\u{20E3}0\u{FE0F}\u{20E3}",l:"30th Birthday"},
  {id:"milestone_40",i:"4\u{FE0F}\u{20E3}0\u{FE0F}\u{20E3}",l:"40th Birthday"},
  {id:"milestone_50",i:"5\u{FE0F}\u{20E3}0\u{FE0F}\u{20E3}",l:"50th Birthday"},
  {id:"anniversary",i:"\u{1F48D}",l:"Anniversary"},
  {id:"honeymoon",i:"\u{1F942}",l:"Honeymoon"},
  {id:"proposal",i:"\u{1F48E}",l:"Planning a Proposal"},
  {id:"first_trip",i:"\u{2728}",l:"First Trip Together"},
  {id:"graduation",i:"\u{1F393}",l:"Graduation"},
  {id:"retirement",i:"\u{1F3C6}",l:"Retirement"},
  {id:"bachelor",i:"\u{1F57A}",l:"Bachelor Party"},
  {id:"bachelorette",i:"\u{1F470}",l:"Bachelorette Party"},
  {id:"family_reunion",i:"\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}",l:"Family Reunion"},
  {id:"friends_reunion",i:"\u{1FAC2}",l:"Friends Reunion"},
  {id:"babymoon",i:"\u{1F37C}",l:"Babymoon"},
  {id:"divorce",i:"\u{1F98B}",l:"Newly Single Trip"},
  {id:"work_retreat",i:"\u{1F4BC}",l:"Work / Team Retreat"},
  {id:"just_fun",i:"\u{1F389}",l:"Just for Fun"},
];

export const DIETARY_OPTIONS = [
  {id:"vegetarian",i:"\u{1F957}",l:"Vegetarian",desc:"No meat or fish"},
  {id:"vegan",i:"\u{1F331}",l:"Vegan",desc:"No animal products"},
  {id:"pescatarian",i:"\u{1F41F}",l:"Pescatarian",desc:"Fish OK, no meat"},
  {id:"no_beef",i:"\u{1F6AB}\u{1F969}",l:"No Beef",desc:"Avoid beef & veal"},
  {id:"no_pork",i:"\u{1F6AB}\u{1F437}",l:"No Pork",desc:"Avoid pork products"},
  {id:"no_lamb",i:"\u{1F6AB}\u{1F411}",l:"No Lamb",desc:"Avoid lamb & mutton"},
  {id:"no_shellfish",i:"\u{1F6AB}\u{1F990}",l:"No Shellfish",desc:"Avoid shrimp, crab, lobster"},
  {id:"no_seafood",i:"\u{1F6AB}\u{1F420}",l:"No Seafood",desc:"No fish or seafood at all"},
  {id:"halal",i:"\u{262A}\u{FE0F}",l:"Halal",desc:"Certified halal food only"},
  {id:"kosher",i:"\u{2721}\u{FE0F}",l:"Kosher",desc:"Certified kosher food only"},
  {id:"glutenfree",i:"\u{1F33E}",l:"Gluten-Free",desc:"No gluten / wheat"},
  {id:"dairyfree",i:"\u{1F95B}",l:"Dairy-Free",desc:"No milk, cheese, butter"},
  {id:"nut_allergy",i:"\u{1F95C}",l:"Nut Allergy",desc:"Strict nut-free required"},
  {id:"no_spicy",i:"\u{1F336}\u{FE0F}",l:"No Spicy Food",desc:"Mild food only"},
  {id:"raw_food",i:"\u{1F959}",l:"Raw / Whole Food",desc:"Minimally processed"},
  {id:"no_alcohol",i:"\u{1F6B1}",l:"No Alcohol",desc:"Alcohol-free options"},
];

export const ACCOMMODATION_TYPES = [
  {id:"hostel",l:"Hostel",i:"\u{1F6CF}\u{FE0F}"},{id:"guesthouse",l:"B&B / Guesthouse",i:"\u{1F3E1}"},
  {id:"midrange",l:"Mid-Range Hotel",i:"\u{1F3E8}"},{id:"boutique",l:"Boutique Hotel",i:"\u{2728}"},
  {id:"luxury",l:"5-Star Luxury",i:"\u{1F451}"},{id:"airbnb",l:"Airbnb / Villa",i:"\u{1F3E0}"},
  {id:"resort",l:"All-Inclusive",i:"\u{1F334}"},{id:"camping",l:"Camping/Glamping",i:"\u{26FA}"},
  {id:"unique",l:"Unique Stay",i:"\u{1F9D9}"},
];

// ─── URL BUILDERS ──────────────────────────────────────────────────────────
// Use picsum.photos for placeholder images (source.unsplash.com was deprecated)
// Seeds based on keyword for consistent images per location
export const imgUrl = (kw,w=800,h=500)=>{
  const seed = Math.abs([...kw].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
  return `https://picsum.photos/seed/${encodeURIComponent(kw.replace(/\s+/g,"-"))}-${seed % 1000}/${w}/${h}`;
};
export const airbnbUrl=(city,ci,co,adults,children,maxB)=>{const p=new URLSearchParams({adults,children:children||0,checkin:ci||"",checkout:co||"",room_type:"entire_home",min_bedrooms:adults>3?2:1,...(maxB?{price_max:maxB}:{})});return`https://www.airbnb.com/s/${encodeURIComponent(city)}/homes?${p}`;};
export const bookingUrl=(city,ci,co,adults)=>`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${ci||""}&checkout=${co||""}&group_adults=${adults}&no_rooms=1`;
export const mapsUrl=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const gygUrl=(act,city)=>`https://www.getyourguide.com/s/?q=${encodeURIComponent(act+" "+city)}`;
export const taUrl=q=>`https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`;
export const viatorUrl=(q)=>`https://www.viator.com/searchResults/all?text=${encodeURIComponent(q)}`;
export const mapsRouteUrl=(origin,destinations)=>{const pts=[origin,...destinations].filter(Boolean).map(d=>encodeURIComponent(d)).join("/");return`https://www.google.com/maps/dir/${pts}`;};
export const hostelworldUrl=(city,ci,co)=>`https://www.hostelworld.com/s?q=${encodeURIComponent(city)}&dateFrom=${ci||""}&dateTo=${co||""}`;
export const hotelsComUrl=(city,ci,co,adults)=>`https://www.hotels.com/Hotel-Search?destination=${encodeURIComponent(city)}&startDate=${ci||""}&endDate=${co||""}&rooms=1&adults=${adults||2}`;
