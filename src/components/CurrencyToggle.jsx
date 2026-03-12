import cs from "../styles/CurrencyToggle.module.css";

// ─── CURRENCY TOGGLE ────────────────────────────────────────────────────────
export function CurrencyToggle({rates,baseCurrency,onToggle,showLocal}){
  if(!rates||!Object.keys(rates).length) return null;
  const currencies=Object.keys(rates);
  return(
    <div className={cs.container}>
      <span className={cs.label}>Currency</span>
      <button onClick={()=>onToggle(null)} className={`${cs.btn} ${!showLocal?cs.btnBaseActive:cs.btnBaseInactive}`}>{baseCurrency}</button>
      {currencies.map(c=>(
        <button key={c} onClick={()=>onToggle(c)} className={`${cs.btn} ${showLocal===c?cs.btnLocalActive:cs.btnLocalInactive}`}>
          {c} <span className={cs.rate}>({rates[c]?.rate?.toFixed(2)})</span>
        </button>
      ))}
    </div>
  );
}

export function convertPrice(amount,rate){
  if(!rate||!amount) return amount;
  const num=typeof amount==="string"?parseFloat(amount.replace(/[^0-9.]/g,"")):amount;
  if(isNaN(num)) return amount;
  return Math.round(num*rate);
}
