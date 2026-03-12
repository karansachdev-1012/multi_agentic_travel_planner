import { useState, useMemo } from "react";
import s from "../styles/PriceTrends.module.css";

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

const TOURISM_COLORS = {
  peak: "#e87070",
  shoulder: "#d4a843",
  "off-peak": "#4caf8e",
};

// Seasonal shape curves (same as backend) — used for frontend fallback
const MONTH_SHAPE = {
  1: 0.72, 2: 0.75, 3: 0.85, 4: 0.92, 5: 1.00, 6: 1.20,
  7: 1.35, 8: 1.30, 9: 1.05, 10: 0.90, 11: 0.78, 12: 1.10,
};
const TOURISM_BY_SHAPE = {
  1:"off-peak",2:"off-peak",3:"shoulder",4:"shoulder",5:"shoulder",6:"peak",
  7:"peak",8:"peak",9:"shoulder",10:"off-peak",11:"off-peak",12:"peak",
};

/** Generate estimated seasonal price data when backend returns nothing */
function generateFallbackData(travelMonth, currency, flightBaseline = 450, hotelBaseline = 120) {
  const travelShape = MONTH_SHAPE[travelMonth] || 1.0;
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const shape = MONTH_SHAPE[month] || 1.0;
    const ratio = shape / travelShape;
    return {
      month,
      month_name: MONTH_NAMES[month],
      avg_flight_price: Math.round(flightBaseline * ratio),
      avg_hotel_price: Math.round(hotelBaseline * ratio),
      tourism_level: TOURISM_BY_SHAPE[month] || "",
    };
  });
}

const CHART_W = 480;
const CHART_H = 180;
const BAR_GAP = 4;
const LABEL_H = 24;
const TOP_PAD = 24;

function BarChart({ data, valueKey, travelMonth, currency, label }) {
  const [hovered, setHovered] = useState(null);

  const maxVal = useMemo(() => {
    const vals = data.map(d => d[valueKey]).filter(Boolean);
    return vals.length ? Math.max(...vals) : 1;
  }, [data, valueKey]);

  const hasData = data.some(d => d[valueKey] != null);
  if (!hasData) return null;

  const barW = (CHART_W - BAR_GAP * 13) / 12;
  const barAreaH = CHART_H - TOP_PAD - LABEL_H;

  const formatPrice = (v) => {
    if (v == null) return "N/A";
    if (v >= 1000) return `${currency} ${(v / 1000).toFixed(1)}k`;
    return `${currency} ${Math.round(v)}`;
  };

  return (
    <div className={s.chartCard}>
      <h4 className={s.chartLabel}>{label}</h4>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className={s.svg}
        role="img"
        aria-label={`${label} price comparison by month`}
      >
        {data.map((d, i) => {
          const val = d[valueKey];
          const barH = val ? (val / maxVal) * barAreaH : 0;
          const x = BAR_GAP + i * (barW + BAR_GAP);
          const y = TOP_PAD + barAreaH - barH;
          const isTravel = d.month === travelMonth;
          const tourism = d.tourism_level || "";

          let fill = "rgba(255,255,255,.12)";
          if (isTravel) fill = "#d4a843";
          else if (tourism === "peak") fill = "rgba(232,112,112,.35)";
          else if (tourism === "off-peak") fill = "rgba(76,175,142,.25)";
          else if (tourism === "shoulder") fill = "rgba(212,168,67,.2)";

          return (
            <g
              key={d.month}
              onMouseEnter={() => setHovered(d.month)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Bar */}
              {val ? (
                <rect
                  x={x} y={y} width={barW} height={barH}
                  rx={3}
                  fill={fill}
                  stroke={isTravel ? "#d4a843" : "none"}
                  strokeWidth={isTravel ? 1.5 : 0}
                  opacity={hovered === d.month ? 1 : 0.85}
                />
              ) : (
                <rect
                  x={x} y={TOP_PAD + barAreaH - 3} width={barW} height={3}
                  rx={1}
                  fill="rgba(255,255,255,.06)"
                />
              )}

              {/* Price label on hover */}
              {hovered === d.month && val && (
                <>
                  <rect
                    x={Math.max(0, x + barW / 2 - 36)} y={y - 22}
                    width={72} height={18} rx={4}
                    fill="rgba(20,18,16,.95)"
                    stroke="rgba(212,168,67,.3)" strokeWidth={0.5}
                  />
                  <text
                    x={x + barW / 2} y={y - 10}
                    textAnchor="middle"
                    fill="#f0ebe0" fontSize="10" fontFamily="DM Sans"
                  >
                    {formatPrice(val)}
                  </text>
                </>
              )}

              {/* Value label on travel month bar always visible */}
              {isTravel && val && hovered !== d.month && (
                <text
                  x={x + barW / 2} y={y - 6}
                  textAnchor="middle"
                  fill="#d4a843" fontSize="9" fontWeight="600" fontFamily="DM Sans"
                >
                  {formatPrice(val)}
                </text>
              )}

              {/* Month label */}
              <text
                x={x + barW / 2}
                y={CHART_H - 4}
                textAnchor="middle"
                fill={isTravel ? "#d4a843" : "rgba(240,235,224,.5)"}
                fontSize="9"
                fontWeight={isTravel ? "700" : "400"}
                fontFamily="DM Sans"
              >
                {SHORT_MONTHS[i]}
              </text>

              {/* Tourism dot */}
              {tourism && (
                <circle
                  cx={x + barW / 2}
                  cy={CHART_H - LABEL_H + 6}
                  r={2.5}
                  fill={TOURISM_COLORS[tourism] || "rgba(255,255,255,.2)"}
                />
              )}
            </g>
          );
        })}

        {/* Y-axis guide lines */}
        {[0.25, 0.5, 0.75].map(frac => {
          const y = TOP_PAD + barAreaH * (1 - frac);
          return (
            <line
              key={frac}
              x1={0} y1={y} x2={CHART_W} y2={y}
              stroke="rgba(255,255,255,.04)" strokeDasharray="3,3"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function PriceTrends({ priceTrends, destination, travelMonth: travelMonthProp, currency: currencyProp }) {
  // Try to extract data from backend response
  let data = null;
  let travelMonth = travelMonthProp || null;
  let currency = currencyProp || "USD";
  let destName = destination || "";
  let isEstimate = false;

  if (priceTrends && Object.keys(priceTrends).length > 0) {
    const destinations = Object.keys(priceTrends);
    const primary = priceTrends[destinations[0]];
    destName = destName || primary?.destination || destinations[0];

    if (primary && !primary.error && primary.monthly_prices?.length) {
      const hasAnyFlights = primary.monthly_prices.some(d => d.avg_flight_price != null && d.avg_flight_price > 0);
      const hasAnyHotels = primary.monthly_prices.some(d => d.avg_hotel_price != null && d.avg_hotel_price > 0);

      if (hasAnyFlights || hasAnyHotels) {
        data = primary.monthly_prices;
        travelMonth = primary.travel_month || travelMonth;
        currency = primary.currency || currency;
      }
    }
  }

  // Frontend fallback: generate estimated seasonal data if backend gave nothing
  if (!data && travelMonth) {
    data = generateFallbackData(travelMonth, currency);
    isEstimate = true;
  }

  if (!data) return null;

  // Calculate overall budget estimate per month
  const overallData = useMemo(() => {
    return data.map(d => {
      const flight = d.avg_flight_price || 0;
      const hotel = d.avg_hotel_price || 0;
      const estimatedNights = 7;
      const overall = flight + hotel * estimatedNights;
      return {
        ...d,
        overall_budget: overall > 0 ? overall : null,
      };
    });
  }, [data]);

  return (
    <div className={s.container}>
      <div className={s.header}>
        <h3 className={s.title}>Price Trends by Month</h3>
        <p className={s.subtitle}>
          Compare costs across the year for {destName}
          {isEstimate && <span style={{opacity:.5,marginLeft:6,fontSize:".75rem"}}>(seasonal estimates)</span>}
        </p>
      </div>

      <div className={s.legend}>
        <span className={s.legendItem}>
          <span className={s.legendDot} style={{ background: "#d4a843" }} />
          Your travel month
        </span>
        <span className={s.legendItem}>
          <span className={s.legendDot} style={{ background: TOURISM_COLORS.peak }} />
          Peak season
        </span>
        <span className={s.legendItem}>
          <span className={s.legendDot} style={{ background: TOURISM_COLORS.shoulder }} />
          Shoulder
        </span>
        <span className={s.legendItem}>
          <span className={s.legendDot} style={{ background: TOURISM_COLORS["off-peak"] }} />
          Off-peak
        </span>
      </div>

      <div className={s.chartsGrid}>
        <BarChart
          data={data}
          valueKey="avg_flight_price"
          travelMonth={travelMonth}
          currency={currency}
          label="Round-Trip Flights"
        />
        <BarChart
          data={data}
          valueKey="avg_hotel_price"
          travelMonth={travelMonth}
          currency={currency}
          label="Hotels (per night)"
        />
        <BarChart
          data={overallData}
          valueKey="overall_budget"
          travelMonth={travelMonth}
          currency={currency}
          label="Est. Total (flights + 7 nights)"
        />
      </div>

      <p className={s.disclaimer}>
        {isEstimate
          ? "Estimates based on typical seasonal demand patterns. Peak months typically cost 30\u201340% more than off-peak. Use the booking links above to check real-time prices."
          : "Based on your travel month prices adjusted for seasonal demand. Peak months typically cost 30\u201340% more than off-peak. Actual prices may vary."
        }
      </p>
    </div>
  );
}
