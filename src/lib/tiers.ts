// ── Pricing config ────────────────────────────────────────────────────────────
// To change prices: update src/lib/tierPricing.json (the single source of
// truth for Stripe price IDs, buy URLs, and display price strings).
// server/index.js derives its ALLOWED_PRICE_IDS from the same file, so only
// one edit is required when the pricing structure changes.
import tierPricingRaw from "./tierPricing.json";

interface TierPricingEntry {
  price: string;
  stripePriceId: string;
  stripeUrl: string;
}
const tierPricing = tierPricingRaw as Record<"tier2" | "tier3", TierPricingEntry>;

export type TierLevel = "free" | "tier2" | "tier3";

export interface Tier {
  level: TierLevel;
  name: string;
  price: string;
  cardLimit: number | null;
  canSave: boolean;
  canEditDecks: boolean;
  /** Whether this tier may forge (generate) cards without spending a referral credit. */
  canGenerate: boolean;
  /** Whether this tier may connect a Craftlingua language profile. */
  canUseCraftlingua: boolean;
  /** Maximum number of decks this tier may own (null = unlimited). */
  maxDecks: number | null;
  description: string;
  features: string[];
  stripeUrl: string | null;
  /** Stripe Price ID used to create a Checkout Session for this tier. */
  stripePriceId: string | null;
}

export const TIERS: Record<TierLevel, Tier> = {
  free: {
    level: "free",
    name: "Free Rider",
    price: "Free",
    cardLimit: 0,
    canSave: false,
    canEditDecks: false,
    canGenerate: false,
    canUseCraftlingua: false,
    maxDecks: 0,
    description: "Explore the app — upgrade or earn referral credits to forge cards.",
    features: [
      "Browse the app",
      "Share cards via link",
      "Earn free generate credits via referrals",
      "No account required",
    ],
    stripeUrl: null,
    stripePriceId: null,
  },
  tier2: {
    level: "tier2",
    name: "Street Creator",
    price: tierPricing.tier2.price,
    cardLimit: 18,
    canSave: true,
    canEditDecks: false,
    canGenerate: true,
    canUseCraftlingua: true,
    maxDecks: 1,
    description: "Sign up and save up to 18 cards in your Collection.",
    features: [
      "Everything in Free",
      "Account & card saving",
      "Collection of up to 18 cards",
      "One deck (add from Collection)",
      "Export your collection",
      "CraftLingua language profiles (Coming Soon)",
    ],
    stripeUrl: tierPricing.tier2.stripeUrl,
    stripePriceId: tierPricing.tier2.stripePriceId,
  },
  tier3: {
    level: "tier3",
    name: "Deck Master",
    price: tierPricing.tier3.price,
    cardLimit: 100,
    canSave: true,
    canEditDecks: true,
    canGenerate: true,
    canUseCraftlingua: true,
    maxDecks: null,
    description: "Full access — 100-card Collection, multiple decks, edit all cards.",
    features: [
      "Everything in Street Creator",
      "Collection of up to 100 cards",
      "Multiple decks (add from Collection)",
      "Edit & delete any card",
      "CraftLingua language profiles (Coming Soon)",
    ],
    stripeUrl: tierPricing.tier3.stripeUrl,
    stripePriceId: tierPricing.tier3.stripePriceId,
  },
};

const TIER_KEY = "skpd_tier";
const EMAIL_KEY = "skpd_email";

export function loadTier(): TierLevel {
  const stored = localStorage.getItem(TIER_KEY);
  if (stored === "tier2" || stored === "tier3") return stored;
  return "free";
}

export function saveTier(level: TierLevel): void {
  localStorage.setItem(TIER_KEY, level);
}

export function loadEmail(): string {
  return localStorage.getItem(EMAIL_KEY) ?? "";
}

export function saveEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearAccount(): void {
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
