// Tier names are stored by the API as Guest/Regular/Insider/Inner Circle;
// the member-facing labels are Silver/Gold/Table Black. Mirrors server.py.
export const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

export const TIER_THRESHOLDS = {
  Guest: 0,
  Regular: 500,
  Insider: 1500,
  "Inner Circle": 3000,
};

const TIER_LABELS = {
  Guest: "Guest",
  Regular: "Silver",
  Insider: "Gold",
  "Inner Circle": "Table Black",
};

export const TOP_TIER = TIER_ORDER[TIER_ORDER.length - 1];

export function tierLabel(tier) {
  return TIER_LABELS[tier] || tier || TIER_LABELS.Guest;
}

export function tierIndex(tier) {
  const i = TIER_ORDER.indexOf(tier || "Guest");
  return i === -1 ? 0 : i;
}

export function meetsTier(userTier, required) {
  return !required || tierIndex(userTier) >= tierIndex(required);
}

export function pointsToTier(lifetimePoints, tier) {
  return Math.max(0, (TIER_THRESHOLDS[tier] ?? 0) - (lifetimePoints || 0));
}

/** "Gold and above", "Table Black only", or "Open to all". */
export function tierRequirementPhrase(required) {
  if (!required || required === "Guest") return "Open to all";
  if (required === TOP_TIER) return `${tierLabel(required)} only`;
  return `${tierLabel(required)} and above`;
}
