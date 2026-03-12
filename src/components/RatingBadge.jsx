import s from "../styles/RatingBadge.module.css";

const RATING_COLORS = {
  high: { bg: "rgba(76,175,142,.12)", border: "rgba(76,175,142,.3)", color: "#4caf8e" },
  medium: { bg: "rgba(212,168,67,.12)", border: "rgba(212,168,67,.3)", color: "#d4a843" },
  low: { bg: "rgba(232,112,112,.12)", border: "rgba(232,112,112,.3)", color: "#e87070" },
};

function ratingLevel(rating) {
  if (rating >= 4.0) return "high";
  if (rating >= 3.0) return "medium";
  return "low";
}

export function RatingBadge({ review }) {
  if (!review || review.error || review.rating == null) return null;

  const level = ratingLevel(review.rating);
  const c = RATING_COLORS[level];

  return (
    <span className={s.tooltip}>
      <span
        className={s.badge}
        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
      >
        <span className={s.star}>⭐</span>
        <span className={s.rating}>{review.rating.toFixed(1)}</span>
        {review.review_count != null && (
          <span className={s.count}>({review.review_count.toLocaleString()})</span>
        )}
      </span>
      {(review.snippets?.length > 0 || review.category) && (
        <span className={s.tooltipContent}>
          <span className={s.tooltipHeader}>{review.place_name}</span>
          {review.category && <span className={s.tooltipCategory}>{review.category}</span>}
          {review.snippets?.slice(0, 2).map((snip, i) => (
            <span key={i} className={s.snippet}>{snip}</span>
          ))}
          <span className={s.tooltipSource}>via {review.source}</span>
        </span>
      )}
    </span>
  );
}
