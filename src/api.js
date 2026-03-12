// ─── API CALL (routed through local proxy) ──────────────────────────────────
export async function askClaude(prompt, maxTokens = 600) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!r.ok) {
    if (r.status === 429) {
      const retryAfter = r.headers.get("Retry-After") || "60";
      throw new Error(`Rate limited. Please wait ${retryAfter}s before trying again.`);
    }
    const errBody = await r.text();
    throw new Error(`API error ${r.status}: ${errBody}`);
  }
  const d = await r.json();
  return d.text || "";
}

// ─── STREAMING API CALL (SSE) ────────────────────────────────────────────────
export async function askClaudeStream(prompt, maxTokens = 600, onChunk) {
  const r = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  if (!r.ok) {
    if (r.status === 429) {
      const retryAfter = r.headers.get("Retry-After") || "60";
      throw new Error(`Rate limited. Please wait ${retryAfter}s before trying again.`);
    }
    const errBody = await r.text();
    throw new Error(`API error ${r.status}: ${errBody}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const { text, error } = JSON.parse(payload);
          if (error) throw new Error(error);
          if (text) {
            fullText += text;
            if (onChunk) onChunk(fullText, text);
          }
        } catch (e) {
          if (e.message && !e.message.includes("Unexpected")) throw e;
          // Skip malformed JSON
        }
      } else if (line.startsWith("event: error")) {
        // Next data line will have the error
      }
    }
  }

  return fullText;
}

// ─── VERIFICATION API ───────────────────────────────────────────────────────
export async function requestVerification(tripPlan, form) {
  try {
    const nights = form.dateFrom && form.dateTo ? Math.round((new Date(form.dateTo) - new Date(form.dateFrom)) / 86400000) : 7;
    const ppB = form.budgetType === "per_person" ? Number(form.budget) : form.budgetType === "total" ? Math.round(Number(form.budget) / (form.adults || 1)) : Number(form.budget) * nights;
    const maxN = Math.round(ppB * (form.adults || 2) * 0.35 / nights);

    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_plan: tripPlan,
        origin: form.origin || "",
        destinations: form.destinations || [],
        check_in: form.dateFrom || "",
        check_out: form.dateTo || "",
        adults: form.adults || 2,
        children: form.children?.length || 0,
        currency: form.currency || "USD",
        budget_per_person: ppB,
        max_nightly: maxN,
      }),
    });
    const data = await r.json();
    if (data.error && data.fallback) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── WEATHER CODE HELPERS ───────────────────────────────────────────────────
export const weatherIcon = (code) => {
  const map = { 0: "\u2600\uFE0F", 1: "\uD83C\uDF24\uFE0F", 2: "\u26C5", 3: "\u2601\uFE0F", 45: "\uD83C\uDF2B\uFE0F", 48: "\uD83C\uDF2B\uFE0F", 51: "\uD83C\uDF26\uFE0F", 53: "\uD83C\uDF26\uFE0F", 55: "\uD83C\uDF27\uFE0F", 61: "\uD83C\uDF26\uFE0F", 63: "\uD83C\uDF27\uFE0F", 65: "\uD83C\uDF27\uFE0F", 71: "\uD83C\uDF28\uFE0F", 73: "\u2744\uFE0F", 75: "\u2744\uFE0F", 80: "\uD83C\uDF26\uFE0F", 81: "\uD83C\uDF27\uFE0F", 82: "\u26C8\uFE0F", 95: "\u26C8\uFE0F" };
  return map[code] || "\u2753";
};

// ─── JSON PARSING ───────────────────────────────────────────────────────────
export function cleanAndParseJSON(raw){
  let t = raw.replace(/```json[\s\S]*?```/gi, m => m.slice(m.indexOf("\n")+1, m.lastIndexOf("```")));
  t = t.replace(/```/g,"").trim();
  const s=t.indexOf("{"), e=t.lastIndexOf("}");
  if(s>=0 && e>s) t=t.slice(s,e+1);
  else throw new Error("No JSON object found in response");
  // Remove trailing commas before } or ]
  t = t.replace(/,([\s\r\n]*[}\]])/g,"$1");
  try{ return JSON.parse(t); }
  catch(err){
    // Fix 1: Escape unescaped newlines inside strings
    t = t.replace(/"((?:[^"\\\n]|\\.)*)"/g, (_,inner)=>
      '"'+inner.replace(/\n/g,"\\n").replace(/\r/g,"")+'"');
    try{ return JSON.parse(t); }
    catch(err2){
      // Fix 2: Repair truncated JSON — close unclosed brackets/braces
      let repaired = t;
      // Remove any trailing incomplete string (unmatched quote)
      const quoteCount = (repaired.match(/(?<!\\)"/g)||[]).length;
      if(quoteCount % 2 !== 0){
        // Odd quotes: truncated mid-string, close it
        repaired = repaired.replace(/,?\s*"[^"]*$/, '');
        if((repaired.match(/(?<!\\)"/g)||[]).length % 2 !== 0) repaired += '"';
      }
      // Remove trailing partial key-value pairs (e.g., "key": or "key":  "val)
      repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/,'');
      // Count unclosed brackets and braces and close them
      let openBraces=0, openBrackets=0, inStr=false, esc=false;
      for(let i=0;i<repaired.length;i++){
        const c=repaired[i];
        if(esc){esc=false;continue;}
        if(c==='\\'){esc=true;continue;}
        if(c==='"'){inStr=!inStr;continue;}
        if(inStr) continue;
        if(c==='{') openBraces++;
        else if(c==='}') openBraces--;
        else if(c==='[') openBrackets++;
        else if(c===']') openBrackets--;
      }
      // Remove any trailing comma before we close
      repaired = repaired.replace(/,\s*$/,'');
      for(let i=0;i<openBrackets;i++) repaired+=']';
      for(let i=0;i<openBraces;i++) repaired+='}';
      // Clean trailing commas again after repair
      repaired = repaired.replace(/,([\s\r\n]*[}\]])/g,"$1");
      try{ return JSON.parse(repaired); }
      catch(err3){ throw new Error("JSON parse failed: "+err2.message); }
    }
  }
}
export function parseJSON(text){ return cleanAndParseJSON(text); }
