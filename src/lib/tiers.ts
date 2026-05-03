// ── Pricing config ────────────────────────────────────────────────────────────
// To change prices: update src/lib/tierPricing.json (the single source of
// truth for Stripe price IDs, buy URLs, and display price strings).
// server/index.js derives its ALLOWED_PRICE_IDS from the same file, so only
// one edit is required when the pricing structure changes.
import tierPricingRaw from "./tierPricing.json";

interface TierPricingEntry {
  price: string;
  annualPrice?: string;
  checkoutMode: "payment" | "subscription";
  stripePriceId: string;
  stripeAnnualPriceId?: string;
  stripeUrl: string;
}
const tierPricing = tierPricingRaw as Record<"tier2" | "tier3" | "seasonPass", TierPricingEntry>;

export type TierLevel = "free" | "tier2" | "tier3";
export type PaidBillingPeriod = "monthly" | "annual";

export interface Tier {
  level: TierLevel;
  name: string;
  price: string;
  annualPrice?: string;
  cardLimit: number | null;
  canSave: boolean;
  canEditDecks: boolean;
  /** Whether this tier may forge (generate) cards without spending a referral credit. */
  canGenerate: boolean;
  /** Whether this tier may connect a Craftlingua language profile. */
  canUseCraftlingua: boolean;
  /** Maximum number of decks this tier may own (null = unlimited). */
  maxDecks: number | null;
  /** Monthly forge credits granted by the paid plan (null = not credit-limited in the current client). */
  monthlyForgeCredits: number | null;
  description: string;
  features: string[];
  stripeUrl: string | null;
  /** Stripe Price ID used to create a Checkout Session for the monthly tier. */
  stripePriceId: string | null;
  /** Stripe Price ID used to create a Checkout Session for the annual tier. */
  stripeAnnualPriceId?: string | null;
  checkoutMode: "payment" | "subscription" | null;
}

export const SEASON_PASS = {
  level: "seasonPass",
  name: "Season Pass",
  price: tierPricing.seasonPass.price,
  description: "Premium 6-week Battle Pass track for cosmetics, titles, frames, and modest forge-credit rewards.",
  features: [
    "Premium Battle Pass reward track",
    "Season-exclusive frames and titles",
    "Cosmetic-first rewards with no pay-to-win stat boosts",
    "Included with Deck Master while subscribed",
  ],
  stripePriceId: tierPricing.seasonPass.stripePriceId || null,
  stripeUrl: tierPricing.seasonPass.stripeUrl || null,
  checkoutMode: tierPricing.seasonPass.checkoutMode,
} as const;

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
    monthlyForgeCredits: null,
    description: "Explore the app — forge a starter card, then use your free daily forge or referral credits.",
    features: [
      "Create 1 starter player card",
      "1 free forge every 24 hours",
      "Browse the app",
      "Download or screenshot cards to share",
      "Earn extra generate credits via referrals",
      "No account required",
    ],
    stripeUrl: null,
    stripePriceId: null,
    checkoutMode: null,
  },
  tier2: {
    level: "tier2",
    name: "Street Creator",
    price: tierPricing.tier2.price,
    annualPrice: tierPricing.tier2.annualPrice,
    cardLimit: 50,
    canSave: true,
    canEditDecks: true,
    canGenerate: true,
    canUseCraftlingua: true,
    maxDecks: 3,
    monthlyForgeCredits: 50,
    description: "A monthly creator plan for casual collectors: cloud saves, crews, trading, and a healthy forge-credit allowance.",
    features: [
      "Everything in Free",
      "50 forge credits per month",
      "Cloud Collection of up to 50 cards",
      "Build up to 3 crews/decks",
      "Basic card editing and trading",
      "Export your collection",
      "CraftLingua language profiles",
    ],
    stripeUrl: tierPricing.tier2.stripeUrl,
    stripePriceId: tierPricing.tier2.stripePriceId,
    stripeAnnualPriceId: tierPricing.tier2.stripeAnnualPriceId || null,
    checkoutMode: tierPricing.tier2.checkoutMode,
  },
  tier3: {
    level: "tier3",
    name: "Deck Master",
    price: tierPricing.tier3.price,
    annualPrice: tierPricing.tier3.annualPrice,
    cardLimit: 250,
    canSave: true,
    canEditDecks: true,
    canGenerate: true,
    canUseCraftlingua: true,
    maxDecks: null,
    monthlyForgeCredits: 150,
    description: "Premium monthly access for serious players: bigger collection, unlimited crews, premium cosmetics, and Season Pass included.",
    features: [
      "Everything in Street Creator",
      "150 forge credits per month",
      "Cloud Collection of up to 250 cards",
      "Unlimited crews/decks",
      "Full edit, delete, print, and export tools",
      "Premium Battle Pass included",
      "Premium cosmetics and CraftLingua profiles",
    ],
    stripeUrl: tierPricing.tier3.stripeUrl,
    stripePriceId: tierPricing.tier3.stripePriceId,
    stripeAnnualPriceId: tierPricing.tier3.stripeAnnualPriceId || null,
    checkoutMode: tierPricing.tier3.checkoutMode,
  },
};

export const FREE_CARD_USED_KEY = "skpd_free_card_used";
export const FREE_FORGE_READY_AT_KEY = "skpd_free_forge_ready_at";

const TIER_KEY = "skpd_tier";
const EMAIL_KEY = "skpd_email";
const CHECKOUT_SESSION_KEY = "skpd_checkout_session_id";

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function clearSessionValue(key: string): void {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function loadTier(): TierLevel {
  const stored = readSessionValue(TIER_KEY);
  if (stored === "tier2" || stored === "tier3") return stored;
  return "free";
}

export function saveTier(level: TierLevel): void {
  writeSessionValue(TIER_KEY, level);
}

export function loadEmail(): string {
  return readSessionValue(EMAIL_KEY) ?? "";
}

export function saveEmail(email: string): void {
  writeSessionValue(EMAIL_KEY, email);
}

export function loadCheckoutSessionId(): string | null {
  return readSessionValue(CHECKOUT_SESSION_KEY);
}

export function saveCheckoutSessionId(sessionId: string): void {
  writeSessionValue(CHECKOUT_SESSION_KEY, sessionId);
}

export function clearCheckoutSessionId(): void {
  clearSessionValue(CHECKOUT_SESSION_KEY);
}

export function loadFreeForgeReadyAt(): number | null {
  const raw = localStorage.getItem(FREE_FORGE_READY_AT_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function saveFreeForgeReadyAt(value: number): void {
  localStorage.setItem(FREE_FORGE_READY_AT_KEY, String(value));
}

export function clearAccount(): void {
  clearSessionValue(TIER_KEY);
  clearSessionValue(EMAIL_KEY);
  clearSessionValue(CHECKOUT_SESSION_KEY);
}
