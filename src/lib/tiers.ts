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
    price: "$5 one-time",
    cardLimit: 2,
    canSave: true,
    canEditDecks: false,
    canGenerate: true,
    canUseCraftlingua: true,
    description: "Sign up and save up to 2 cards or characters.",
    features: [
      "Everything in Free",
      "Account & card saving",
      "Create & edit up to 2 cards",
      "Export your collection",
      "CraftLingua language profiles",
    ],
    stripeUrl: "https://buy.stripe.com/4gW2bUeLCceFa3x8M2",
    stripePriceId: "price_1TJOKHRCr5JxQN06wMYFHTm5",
  },
  tier3: {
    level: "tier3",
    name: "Deck Master",
    price: "$10 one-time",
    cardLimit: null,
    canSave: true,
    canEditDecks: true,
    canGenerate: true,
    canUseCraftlingua: true,
    description: "Full access — edit all cards, build decks, manage characters.",
    features: [
      "Everything in Street Creator",
      "Unlimited cards & characters",
      "Full deck builder",
      "Edit & delete any card",
      "CraftLingua language profiles",
    ],
    stripeUrl: "https://buy.stripe.com/cNi5kF3XOcFA4DH1w25ZC01",
    stripePriceId: "price_1TJOKrRCr5JxQN06RyDF02bi",
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
