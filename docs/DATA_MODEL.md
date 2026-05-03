# Firestore Data Model

> Auto-generated from `firestore.rules`, `firestore.indexes.json`, and `src/lib/types.ts`.
> Last updated: Sprint 0.

---

## Collections Overview

| Collection | Scope | Key | Access Pattern |
|---|---|---|---|
| `users/{uid}/cards` | Sub-collection | `cardId` | Owner read/write |
| `users/{uid}/decks` | Sub-collection | `deckId` | Owner read/write |
| `userProfiles` | Top-level | `uid` | Owner + admin read; validated create/update |
| `userLookup` | Top-level | `uid` | Any authed read; owner create/update |
| `imageCache` | Top-level | `cacheKey` (layer+seed hash) | Public read; authed create; no update; admin delete |
| `trades` | Top-level | `tradeId` | Participant + pending-browse read; offerer create; recipient/offerer update |
| `referralClaims` | Top-level | `{referrerUid}_{visitorKey}` | Referrer read; anyone create (no self-referral); immutable |
| `arena` | Top-level | `uid` | Any authed read; owner write/delete |
| `battleResults` | Top-level | `resultId` | Participant read; server-only write |
| `leaderboard` | Top-level | `uid` | Any authed read; owner write |
| `factionImages` | Top-level | `factionKey` (slug) | Public read; admin write/delete |

---

## Document Shapes

### `users/{uid}/cards/{cardId}` — CardPayload

Owner-only sub-collection. Each document mirrors `CardPayload` from `src/lib/types.ts`.

```
{
  id: string,                   // same as doc ID
  version: string,
  seed: string,                 // "frameSeed::backgroundSeed::characterSeed"
  frameSeed: string,
  backgroundSeed: string,
  characterSeed: string,
  prompts: {
    archetype: Archetype,
    rarity: Rarity,
    style: Style,
    vibe?: Vibe,                // deprecated
    district: District,
    accentColor: string,
    gender: Gender,
    ageGroup: AgeGroup,
    bodyType: BodyType,
    hairLength?: HairLength,
    hairColor?: HairColor,
    skinTone?: SkinTone,
    faceCharacter?: FaceCharacter,
    shoeStyle?: ShoeStyle,
  },
  identity: {
    name: string,
    crew: Faction,
    serialNumber: string,
    age?: string,
  },
  stats: {
    speed: number,
    stealth: number,
    tech: number,
    grit: number,
    rep: number,
  },
  traits: {
    passiveTrait: { name: string, description: string },
    activeAbility: { name: string, description: string },
    personalityTags: string[],
  },
  visuals: {
    helmetStyle: string,
    boardStyle: string,
    jacketStyle: string,
    colorScheme: string,
    accentColor: string,
    storagePackStyle: string,
  },
  flavorText: string,
  tags: string[],
  ozzies?: number,              // base Ozzy value assigned at forge time; increases via missions/events
  xp?: number,                 // accumulated gameplay XP — starts at 0, max 100,000,000
  board?: BoardConfig,
  boardLoadout?: BoardLoadout,
  boardImageUrl?: string,
  createdAt: string,
  imageUrl?: string,            // legacy single-image
  backgroundImageUrl?: string,
  characterImageUrl?: string,
  frameImageUrl?: string,
  conlang?: ConlangOverlay,
  discovery?: {
    displayArchetype?: string,
    revealedFaction?: Faction,
    isSecretReveal?: boolean,
    logoMark?: string,
    unlockedAt?: string,
  },
}
```

### `users/{uid}/decks/{deckId}` — DeckPayload

Owner-only sub-collection.

```
{
  id: string,
  version: string,
  name: string,
  cards: CardPayload[],         // embedded card array
  createdAt: string,
  updatedAt: string,
  sortOrder?: number,
  battleReady?: boolean,
}
```

### `userProfiles/{uid}`

Private profile. Owner + admin read. Validated field allowlist on create/update.

```
{
  uid: string,
  email: string,
  emailLower: string,
  displayName: string,
  discoveredFactions: any,      // faction discovery state
  updatedAt: Timestamp,
}
```

**Create allowlist:** `uid`, `email`, `emailLower`, `displayName`, `discoveredFactions`, `updatedAt`.
**Update allowlist:** `email`, `emailLower`, `displayName`, `discoveredFactions`, `updatedAt`.

### `userLookup/{uid}`

Minimal public directory for trade recipient lookup.

```
{
  uid: string,
  emailLower: string,
  displayName: string,
  updatedAt: Timestamp,
}
```

### `imageCache/{cacheKey}`

Fal.ai image URL cache keyed by layer+seed. Public read, authed create, immutable.

```
{
  imageUrl: string,             // must match fal.media or Firebase Storage URL pattern
  createdAt: Timestamp,
  prompt?: string,              // ≤ 512 chars
  layer?: string,               // ≤ 64 chars
  seed?: string,                // ≤ 512 chars
}
```

### `trades/{tradeId}` — TradePayload

Peer-to-peer card trades and Community Market listings.

```
{
  id: string,
  fromUid: string,
  fromEmail: string,
  toUid: string,
  toEmail: string,
  offeredCardId?: string,
  offeredCard: CardPayload,     // embedded snapshot
  status: "pending" | "accepted" | "declined" | "cancelled",
  createdAt: string,
  updatedAt: string,
}
```

### `referralClaims/{referrerUid}_{visitorKey}`

Immutable referral tracking. Unauthenticated create allowed (no self-referral).

```
{
  referrerUid: string,
  visitorKey: string,
  claimedAt: Timestamp,
}
```

### `arena/{uid}` — ArenaEntry

Public battle-ready deck listings. Owner write/delete.

```
{
  uid: string,
  displayName: string,
  deckId: string,
  deckName: string,
  cardCount: number,
  battleSummary?: {
    deckPower: number,
    strongestStat: StatKey,
    strongestStatTotal: number,
    synergyBonusPct: number,
    archetypeHint: string,
  },
  battleDeck?: BattleCardSnapshot[],
  readiedAt: string,
}
```

### `battleResults/{resultId}` — BattleResult

Server-written battle outcomes. Participant read only.

```
{
  id: string,
  challengerUid: string,
  challengerDeckId: string,
  challengerDeckName: string,
  defenderUid: string,
  defenderDeckId: string,
  defenderDeckName: string,
  winnerUid: string,
  challengerScore: number,
  defenderScore: number,
  wagerPoints: number,
  winningDeckCardIds: string[],
  challengerCardResolutions: BattleCardResolution[],
  defenderCardResolutions: BattleCardResolution[],
  createdAt: string,
}
```

### `leaderboard/{uid}` — LeaderboardEntry

Public leaderboard. Owner write. Ordered by `deckPower` DESC, `ozzies` DESC.

```
{
  uid: string,
  displayName: string,
  deckName: string,             // player-facing Crew name
  cardCount: number,
  deckPower: number,            // Deck Power = sum of all stat Points across active 6-card Crew
  ozzies: number,               // legacy stat-based worth (backward compat)
  crewOzzies?: number,          // sum of card Ozzy values across active 6-card Crew
  crewXp?: number,              // sum of card XP across active 6-card Crew
  leaderboardScore?: number,    // deckPower + crewOzzies + (crewXp / 10,000) + districtRep
  strongestStat: StatKey,
  strongestStatTotal: number,
  synergyBonusPct: number,
  archetypeHint: string,
  updatedAt: string,
}
```

See `docs/PROGRESSION.md` for the full leaderboard scoring formula.

### `factionImages/{factionKey}`

Faction background images. Public read, admin write.

```
{
  imageUrl: string,             // faction background image URL
  updatedAt?: Timestamp,
}
```

---

## Composite Indexes (`firestore.indexes.json`)

| Collection | Fields | Query Scope |
|---|---|---|
| `trades` | `status` ASC, `createdAt` DESC | COLLECTION |
| `leaderboard` | `deckPower` DESC, `ozzies` DESC | COLLECTION |

---

## New Collections (Sprint 0 — read-only stubs)

The following collections are defined in `firestore.rules` as read-only stubs
(authenticated read, no client write) pending full implementation:

| Collection | Purpose | Owner |
|---|---|---|
| `dailyStreaks/{uid}` | Daily login streak tracking | Gamma |
| `battlePass/{uid}` | Battle pass tier + XP state | Gamma |
| `crews/{crewId}` | Player crew / guild membership | Charlie |
| `rankedSeasons/{seasonId}` | Ranked season config + standings | Charlie |
| `shareLinks/{linkId}` | Shareable card / deck links | Charlie |

Document shapes for these collections will be defined in `src/lib/sharedTypes.ts`
as implementation progresses.

---

## Missions Collection (Sprint 2)

### `missions/{missionId}` — Mission

Doc ID format: `{uid}_{definitionId}` (e.g. `abc123_grid-trace`).

Owner-only read. All writes are server-only.

```
{
  id: string,                  // same as doc ID
  uid: string,                 // owner uid
  system: "mission_board",
  schemaVersion: 2,
  definitionId: string,        // stable mission template key
  sortOrder: number,
  title: string,
  tagline: string,
  description: string,
  district: District,          // contract destination / district gate
  rewardXp: number,
  rewardOzzies: number,
  requirements: MissionRequirement[],
  status: "active" | "completed" | "expired",
  progress: number,            // 0 until cleared, 1 after success
  target: number,              // currently 1 for route contracts
  createdAt: string,           // ISO 8601
  updatedAt: string,           // ISO 8601
  completedAt?: string,        // ISO 8601
  selectedDeckId?: string,     // last deck used for this mission
  selectedDeckName?: string,
  lastRunAt?: string,          // ISO 8601
  lastRunSucceeded?: boolean,
  lastRunSummary?: string,
  lastRunFailureReasons?: string[],
}
```

The server seeds one board per user, validates chosen decks against mission requirements,
and writes completion / failure state back into these documents. Mission rewards are persisted
onto `userProfiles/{uid}.missionXp` and `userProfiles/{uid}.missionOzzies`.
