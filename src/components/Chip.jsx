import cs from "../styles/Chip.module.css";

export function Chip({active,onClick,icon,label,color="#d4a843",desc}){
  // Dynamic color must stay inline since CSS modules can't handle prop-driven colors
  const dynamicStyle=active
    ?{border:`1.5px solid ${color}`,background:`${color}22`,color}
    :{};
  return(
    <button onClick={onClick} title={desc} className={`${cs.chip} ${active?"":cs.chipInactive}`} style={dynamicStyle}>
      {icon&&<span>{icon}</span>}{label}
    </button>
  );
}

export function RGroup({options,value,onChange}){
  return (<div className={cs.group}>{options.map(o=><Chip key={o.id||o.l} active={value===(o.id||o.l)} onClick={()=>onChange(o.id||o.l)} icon={o.i||o.icon} label={o.l||o.label}/>)}</div>);
}

export function MGroup({options,selected,onToggle,color="#d4a843"}){
  return (<div className={cs.group}>{options.map(o=><Chip key={o.id} active={selected.includes(o.id)} onClick={()=>onToggle(o.id)} icon={o.i||o.icon} label={o.l||o.label} color={color} desc={o.desc}/>)}</div>);
}

export function InpF({label,value,onChange,placeholder,type="text",rows}){
  return (<div className={cs.inputWrap}>
    {label&&<div className={cs.label}>{label}</div>}
    {rows?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cs.textarea}/>
         :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={cs.input}/>}
  </div>);
}
