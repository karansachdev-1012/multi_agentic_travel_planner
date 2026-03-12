import { useCallback, useRef } from "react";

/**
 * Hook for streaming verification — calls /api/verify/stream and
 * invokes onUpdate(snapshot) each time an agent completes.
 * Falls back to the non-streaming /api/verify endpoint if streaming fails.
 */
export function useVerification() {
  const abortRef = useRef(null);

  const startVerification = useCallback(async (tripPlan, form, { onUpdate, onDone, onError }) => {
    // Cancel any in-flight verification
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const nights = form.dateFrom && form.dateTo
      ? Math.round((new Date(form.dateTo) - new Date(form.dateFrom)) / 86400000)
      : 7;
    const ppB = form.budgetType === "per_person"
      ? Number(form.budget)
      : form.budgetType === "total"
        ? Math.round(Number(form.budget) / (form.adults || 1))
        : Number(form.budget) * nights;
    const maxN = Math.round(ppB * (form.adults || 2) * 0.35 / nights);

    const body = {
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
      children_ages: form.children || [],
      passport_country: form.passportCountry || "",
      accommodation_types: form.accommodation || [],
    };

    // Try streaming first
    try {
      const r = await fetch("/api/verify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!r.ok) throw new Error(`Stream error ${r.status}`);

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastSnapshot = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") {
              if (lastSnapshot && onDone) onDone(lastSnapshot);
              return;
            }
            try {
              const evt = JSON.parse(payload);
              if (evt.snapshot) {
                lastSnapshot = evt.snapshot;
                if (onUpdate) onUpdate(evt.snapshot, evt.agent, evt.status);
              }
            } catch {
              // Skip malformed JSON
            }
          } else if (line.startsWith("event: error")) {
            // Error event — will be followed by data
          }
        }
      }

      // If we get here without [DONE], still call onDone with last snapshot
      if (lastSnapshot && onDone) onDone(lastSnapshot);

    } catch (err) {
      if (err.name === "AbortError") return; // Cancelled by user

      // Fallback to non-streaming
      console.warn("Streaming verification failed, falling back:", err.message);
      try {
        const r = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await r.json();
        if (data.error && data.fallback) {
          if (onDone) onDone(null);
          return;
        }
        if (onUpdate) onUpdate(data);
        if (onDone) onDone(data);
      } catch (fallbackErr) {
        if (fallbackErr.name === "AbortError") return;
        if (onError) onError(fallbackErr);
        if (onDone) onDone(null);
      }
    }
  }, []);

  const cancelVerification = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return { startVerification, cancelVerification };
}
