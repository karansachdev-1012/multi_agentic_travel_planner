import { useState } from "react";

// PDF library is loaded dynamically on first export click to avoid
// bundling ~1.5MB of @react-pdf/renderer into the main chunk.

const gold = "#b8962e";
const dark = "#1a1a1a";
const mid = "#444";
const light = "#777";

function buildStyles(StyleSheet) {
  return StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: dark },
    header: { marginBottom: 20, borderBottom: `2px solid ${gold}`, paddingBottom: 12 },
    title: { fontSize: 22, fontWeight: "bold", color: dark, marginBottom: 4 },
    tagline: { fontSize: 11, color: mid, marginBottom: 8 },
    statsRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
    stat: { fontSize: 9, color: light },
    sectionTitle: { fontSize: 14, fontWeight: "bold", color: dark, marginTop: 16, marginBottom: 8, borderBottom: `1px solid #ddd`, paddingBottom: 4 },
    dayHeader: { fontSize: 12, fontWeight: "bold", color: gold, marginTop: 12, marginBottom: 6 },
    dayMeta: { fontSize: 9, color: light, marginBottom: 4 },
    actRow: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
    actTime: { width: 55, fontSize: 9, color: gold, fontWeight: "bold" },
    actBody: { flex: 1 },
    actName: { fontSize: 10, fontWeight: "bold", color: dark },
    actDesc: { fontSize: 9, color: mid, marginTop: 1 },
    dining: { marginTop: 6, paddingLeft: 8, flexDirection: "row", gap: 6 },
    diningIcon: { fontSize: 10, color: gold },
    diningText: { flex: 1, fontSize: 9, color: mid },
    weatherRow: { flexDirection: "row", gap: 12, marginBottom: 2, paddingLeft: 8 },
    weatherDay: { fontSize: 9, color: mid },
    budgetTable: { marginTop: 8 },
    budgetRow: { flexDirection: "row", borderBottom: "0.5px solid #eee", paddingVertical: 3 },
    budgetCat: { flex: 2, fontSize: 9, color: dark },
    budgetVal: { flex: 1, fontSize: 9, color: mid, textAlign: "right" },
    budgetTotal: { flex: 1, fontSize: 9, color: dark, fontWeight: "bold", textAlign: "right" },
    safetyRow: { flexDirection: "row", gap: 8, marginBottom: 4, paddingLeft: 8 },
    safetyText: { fontSize: 9, color: mid },
    footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: light, textAlign: "center", borderTop: "0.5px solid #ddd", paddingTop: 6 },
    accomRow: { marginBottom: 4, paddingLeft: 8 },
    accomName: { fontSize: 10, fontWeight: "bold", color: dark },
    accomDetail: { fontSize: 9, color: mid },
    tipCard: { marginBottom: 4, paddingLeft: 8 },
    tipText: { fontSize: 9, color: mid },
  });
}

function TripPdf({ data, verification, R }) {
  const { Document, Page, Text, View, StyleSheet } = R;
  const styles = buildStyles(StyleSheet);
  const days = data.days || [];
  const budget = data.budget || {};
  const accommodations = data.accommodations || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.tripTitle || "Trip Plan"}</Text>
          {data.tagline && <Text style={styles.tagline}>{data.tagline}</Text>}
          <View style={styles.statsRow}>
            <Text style={styles.stat}>{data.checkIn} - {data.checkOut}</Text>
            <Text style={styles.stat}>{data.totalNights} nights</Text>
            <Text style={styles.stat}>{data.adults} adults{data.children > 0 ? `, ${data.children} kids` : ""}</Text>
            <Text style={styles.stat}>{data.currency} {Number(budget.perPerson || 0).toLocaleString()}/pp</Text>
          </View>
        </View>

        {verification?.safety && Object.keys(verification.safety).length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Travel Advisory</Text>
            {Object.entries(verification.safety).map(([dest, s]) => (
              <View key={dest} style={styles.safetyRow}>
                <Text style={styles.safetyText}>
                  {s.emoji} {dest}: {s.level} risk (score {s.score}/5) — {s.advice}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Day-by-Day Itinerary</Text>
        {days.map((d) => (
          <View key={d.dayNum} wrap={false}>
            <Text style={styles.dayHeader}>Day {d.dayNum} — {d.location}</Text>
            <Text style={styles.dayMeta}>{d.date} | {d.theme}</Text>
            {(d.activities || []).map((a, i) => (
              <View key={i} style={styles.actRow}>
                <Text style={styles.actTime}>{a.time}</Text>
                <View style={styles.actBody}>
                  <Text style={styles.actName}>
                    {a.name}{a.costPP ? ` (${a.costPP})` : ""}
                  </Text>
                  <Text style={styles.actDesc}>{a.description}</Text>
                </View>
              </View>
            ))}
            {d.diningTip && (
              <View style={styles.dining}>
                <Text style={styles.diningIcon}>Dining:</Text>
                <Text style={styles.diningText}>
                  {d.diningTip.name} — {d.diningTip.description}
                </Text>
              </View>
            )}
          </View>
        ))}

        {verification?.weather && Object.keys(verification.weather).length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Weather Forecast</Text>
            {Object.entries(verification.weather).map(([dest, w]) =>
              w.days?.map((wd, i) => (
                <View key={`${dest}-${i}`} style={styles.weatherRow}>
                  <Text style={styles.weatherDay}>
                    {wd.date}: {wd.description} — {Math.round(wd.temp_high)}/{Math.round(wd.temp_low)}
                    {wd.precipitation_chance > 15 ? ` | ${wd.precipitation_chance}% rain` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {accommodations.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Accommodations</Text>
            {accommodations.map((acc, i) => (
              <View key={i} style={styles.accomRow}>
                <Text style={styles.accomName}>{acc.location} — {acc.nights} nights</Text>
                <Text style={styles.accomDetail}>{acc.checkIn} to {acc.checkOut}</Text>
                {(acc.options || []).map((opt, j) => (
                  <Text key={j} style={styles.accomDetail}>
                    {opt.name} ({opt.type}) — {opt.priceRange}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {budget.breakdown && (
          <View>
            <Text style={styles.sectionTitle}>Budget Breakdown ({data.currency})</Text>
            <View style={styles.budgetTable}>
              <View style={styles.budgetRow}>
                <Text style={{ ...styles.budgetCat, fontWeight: "bold" }}>Category</Text>
                <Text style={styles.budgetTotal}>Per Person</Text>
                <Text style={styles.budgetTotal}>Total</Text>
              </View>
              {(budget.breakdown || []).map((row, i) => (
                <View key={i} style={styles.budgetRow}>
                  <Text style={styles.budgetCat}>{row.category}</Text>
                  <Text style={styles.budgetVal}>{row.perPerson?.toLocaleString()}</Text>
                  <Text style={styles.budgetVal}>{row.total?.toLocaleString()}</Text>
                </View>
              ))}
              <View style={[styles.budgetRow, { borderTop: `1px solid ${gold}` }]}>
                <Text style={{ ...styles.budgetCat, fontWeight: "bold" }}>Total</Text>
                <Text style={styles.budgetTotal}>{Number(budget.perPerson || 0).toLocaleString()}</Text>
                <Text style={styles.budgetTotal}>{Number(budget.total || 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}

        {data.tips?.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Travel Tips</Text>
            {data.tips.map((tip, i) => (
              <View key={i} style={styles.tipCard}>
                <Text style={styles.tipText}>{tip.emoji} {tip.title}: {tip.text}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by TripMind — {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}

export function PdfExportButton({ data, verification }) {
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    setGenerating(true);
    try {
      // Dynamic import — only loads the ~1.5MB library when user clicks
      const R = await import("@react-pdf/renderer");
      const blob = await R.pdf(
        <TripPdf data={data} verification={verification} R={R} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data.tripTitle || "trip-plan").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={generating}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        background: generating ? "rgba(212,168,67,.3)" : "rgba(212,168,67,.15)",
        border: "1px solid rgba(212,168,67,.3)",
        borderRadius: 8,
        color: "#d4a843",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        cursor: generating ? "wait" : "pointer",
        transition: "all .2s",
      }}
    >
      {generating ? "Generating..." : "Export PDF"}
    </button>
  );
}
