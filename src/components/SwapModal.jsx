import { useState, useEffect, useCallback } from "react";
import { useTrip } from "../context/TripContext.jsx";
import { searchHotels, getRestaurantAlternatives } from "../api.js";
import s from "../styles/SwapModal.module.css";

export default function SwapModal() {
  const {
    swapModal, setSwapModal, form, tripData, verification,
    updateHotel, updateDiningTip, updateAccommodation,
  } = useTrip();

  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);

  // Load alternatives when modal opens
  useEffect(() => {
    if (!swapModal) { setAlternatives([]); return; }

    if (swapModal.type === "hotel") {
      // Show already-scraped hotels for this location (excluding the current one)
      const existing = verification?.hotels?.[swapModal.location] || [];
      const filtered = existing.filter((_, i) => i !== swapModal.itemIndex);
      setAlternatives(filtered);
    } else if (swapModal.type === "restaurant") {
      // Fetch alternatives from Claude
      setLoading(true);
      const location = swapModal.location || "";
      const date = swapModal.date || "";
      const currentName = swapModal.currentName || "";
      const dietary = form.dietary?.join(", ") || "";
      getRestaurantAlternatives(location, date, currentName, dietary)
        .then(alts => { setAlternatives(alts); setLoading(false); })
        .catch(() => { setAlternatives([]); setLoading(false); });
    }
  }, [swapModal]);

  const handleSearchMore = useCallback(async () => {
    if (!swapModal || swapModal.type !== "hotel") return;
    setSearchingMore(true);
    const results = await searchHotels(
      swapModal.location,
      form.dateFrom, form.dateTo,
      form.adults, form.children?.length || 0,
      0, form.currency || "USD",
    );
    if (results.length) {
      // Merge with existing, deduplicate by name
      setAlternatives(prev => {
        const names = new Set(prev.map(h => h.name));
        const newOnes = results.filter(r => !names.has(r.name));
        return [...prev, ...newOnes];
      });
    }
    setSearchingMore(false);
  }, [swapModal, form]);

  const selectHotel = useCallback((hotel) => {
    if (!swapModal) return;
    updateHotel(swapModal.location, swapModal.itemIndex, hotel);
  }, [swapModal, updateHotel]);

  const selectRestaurant = useCallback((restaurant) => {
    if (!swapModal) return;
    updateDiningTip(swapModal.dayIndex, {
      name: restaurant.name,
      description: restaurant.description,
      estimatedCostPP: restaurant.estimatedCostPP || 0,
      mapsQuery: restaurant.mapsQuery || `${restaurant.name} ${swapModal.location}`,
    });
  }, [swapModal, updateDiningTip]);

  if (!swapModal) return null;

  const currentPrice = swapModal.currentPrice || 0;

  return (
    <div className={s.overlay} onClick={() => setSwapModal(null)}>
      <div className={s.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={s.header}>
          <div>
            <h3 className={s.title}>
              {swapModal.type === "hotel" ? "Swap Hotel" : "Change Restaurant"}
            </h3>
            <p className={s.subtitle}>
              {swapModal.type === "hotel"
                ? `Hotels in ${swapModal.location}`
                : `Restaurants near ${swapModal.location}`
              }
            </p>
          </div>
          <button className={s.closeBtn} onClick={() => setSwapModal(null)}>
            &times;
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className={s.loadingWrap}>
            <div className={s.spinner} />
            <p>Finding alternatives...</p>
          </div>
        )}

        {/* Alternatives grid */}
        {!loading && alternatives.length > 0 && (
          <div className={s.grid}>
            {alternatives.map((alt, i) => (
              <div key={i} className={s.card}>
                <div className={s.cardTop}>
                  <h4 className={s.cardName}>{alt.name}</h4>
                  {alt.source && <span className={s.cardSource}>{alt.source}</span>}
                </div>

                {alt.description && (
                  <p className={s.cardDesc}>{alt.description}</p>
                )}

                <div className={s.cardMeta}>
                  {/* Hotel-specific */}
                  {swapModal.type === "hotel" && alt.price_per_night && (
                    <div className={s.priceCompare}>
                      <span className={s.price}>
                        {form.currency || "$"}{Math.round(alt.price_per_night)}/night
                      </span>
                      {currentPrice > 0 && (
                        <span className={
                          alt.price_per_night < currentPrice ? s.saveBadge :
                          alt.price_per_night > currentPrice ? s.increaseBadge : s.sameBadge
                        }>
                          {alt.price_per_night < currentPrice
                            ? `Save ${form.currency || "$"}${Math.round(currentPrice - alt.price_per_night)}/night`
                            : alt.price_per_night > currentPrice
                            ? `+${form.currency || "$"}${Math.round(alt.price_per_night - currentPrice)}/night`
                            : "Same price"
                          }
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hotel rating */}
                  {alt.rating && (
                    <span className={s.rating}>
                      {"★".repeat(Math.round(alt.rating))} {alt.rating}
                      {alt.review_count ? ` (${alt.review_count.toLocaleString()})` : ""}
                    </span>
                  )}

                  {/* Restaurant cost */}
                  {swapModal.type === "restaurant" && alt.estimatedCostPP && (
                    <span className={s.price}>
                      ~{form.currency || "$"}{alt.estimatedCostPP}/person
                    </span>
                  )}
                </div>

                <button
                  className={s.selectBtn}
                  onClick={() => swapModal.type === "hotel" ? selectHotel(alt) : selectRestaurant(alt)}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && alternatives.length === 0 && (
          <div className={s.empty}>
            <p>No alternatives found yet.</p>
            {swapModal.type === "hotel" && (
              <button className={s.searchMoreBtn} onClick={handleSearchMore} disabled={searchingMore}>
                {searchingMore ? "Searching..." : "Search for Hotels"}
              </button>
            )}
          </div>
        )}

        {/* Search more button for hotels */}
        {swapModal.type === "hotel" && alternatives.length > 0 && (
          <div className={s.footer}>
            <button className={s.searchMoreBtn} onClick={handleSearchMore} disabled={searchingMore}>
              {searchingMore ? "Searching..." : "Search for More Options"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
