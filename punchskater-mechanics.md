# PunchSkater × CraftLingua Integration Guide

This document describes the five game mechanics that use CraftLingua's linguistic engine
inside PunchSkater, including API call examples and implementation notes for the PunchSkater dev team.

---

## Base URL

All CraftLingua API endpoints are served at:

```
https://craftlingua.app/api
```

---

## Authentication

### Public endpoints (no key required)
`GET /api/public/district/:name` and `GET /api/public/districts` are unauthenticated and
publicly cacheable. Call them at build/deploy time where possible.

### Partner-key protected endpoints
`POST /api/public/translate` requires the `X-Partner-Key` header set to the shared secret
stored in your environment as `PUNCHSKATER_PARTNER_KEY`.

```
X-Partner-Key: <secret>
```

---

## District Language Reference

| District | Language Name | Phoneme | Morpheme | Lexeme | Semantic | Pragmatic |
|---|---|---|---|---|---|---|
| `airaway` | Airaway Slang | Harmonic | Isolating | Technology | Contextual | Formal |
| `nightshade` | Nightshade Cipher | Harmonic | Fusional | Emotion | Metaphorical | Emphatic |
| `batteryville` | Batteryville Cant | Alien | Isolating | Technology | Literal | Formal |
| `the-grid` | Grid Protocol | Alien | Isolating | Technology | Literal | Formal |
| `the-forest` | Forest Cant | Naturalistic | Fusional | Nature | Metaphorical | Inclusive |
| `glass-city` | Glass City Prestige | Naturalistic | Agglutinative | Emotion | Metaphorical | Formal |

---

## Deep-Link URL Scheme

CraftLingua supports a `?load=<shareCode>` URL parameter that pre-fills the language wizard
with a district language and jumps directly to the results step. Use this for "DECODE with CraftLingua"
buttons and "Explore This Language →" links.

```
https://craftlingua.app/?load=<shareCode>
```

Each district's `shareCode` is returned by `GET /api/public/district/:name`.
The share code is a stable, deterministic base64url-encoded JSON payload — it will not change
between deploys, so you can safely hardcode it in static assets.

---

## Mechanic 1 — Codex Cipher Challenges

**Concept:** A weekly cipher puzzle appears in the PunchSkater Codex. A short English intel message
is translated into a district's conlang. Players decode it using CraftLingua's Scriptorium.
First N correct decoders win Codex Points or a rare card.

### Implementation steps

**Step 1 — Translate the secret phrase**
```bash
curl -X POST https://craftlingua.app/api/public/translate \
  -H "Content-Type: application/json" \
  -H "X-Partner-Key: $PUNCHSKATER_PARTNER_KEY" \
  -d '{"text": "The package is hidden beneath the old fountain.", "districtName": "nightshade"}'
```

**Response:**
```json
{
  "translated": "Keth- ra-za dolam-za memal-za vithan-za -ven!",
  "shareCode": "eyJjcmFmdExpbmd1YVZlcnNpb24iOjEsIm5hbWUi...",
  "deepLinkUrl": "https://craftlingua.app/?load=eyJjcmFmdExp...",
  "districtName": "nightshade"
}
```

**Step 2 — Store both strings on the Codex puzzle record**
```
puzzle.englishText  = "The package is hidden beneath the old fountain."
puzzle.conlangText  = translated
puzzle.shareCode    = shareCode
puzzle.deepLinkUrl  = deepLinkUrl
```

**Step 3 — Render the Codex challenge page**
- Display `conlangText` in a monospace / glyph-style block
- Show a "DECODE with CraftLingua" button linking to `deepLinkUrl`
- When the player submits their answer, compare (case-insensitive trim) against `englishText`

**Player flow:**
1. Player clicks "DECODE with CraftLingua" → arrives at `craftlingua.app/?load=<shareCode>`
2. CraftLingua pre-loads the Nightshade Cipher language in the wizard
3. Player types the cipher text into the Scriptorium reverse-translation panel
4. Player copies the decoded English back to PunchSkater and submits

**Conversion opportunity:** The account prompt fires when the player tries to save the language.

---

## Mechanic 2 — Courier Card Flavor Text

**Concept:** Rare and Legendary courier cards include a short flavor quote in their district's conlang.
Tapping the card toggles between conlang and English.

### Implementation steps

**Step 1 — Card Forge (Rare/Legendary cards only)**
```bash
curl -X POST https://craftlingua.app/api/public/translate \
  -H "Content-Type: application/json" \
  -H "X-Partner-Key: $PUNCHSKATER_PARTNER_KEY" \
  -d '{"text": "Every path through the Grid is watched.", "districtName": "the-grid"}'
```

**Store on card record:**
```
card.flavorEnglish  = "Every path through the Grid is watched."
card.flavorConlang  = response.translated
card.languageCode   = response.shareCode
```

**Step 2 — Card UI**
```
[ Card front ]
  ┌─────────────────────────────┐
  │  ▓▓ GRID PROTOCOL ▓▓        │
  │  θøɯɯ ʒøʁɯð θøɯɯ ʒøʁɯð    │  ← conlangText, monospace
  │  [tap to translate]          │
  └─────────────────────────────┘

[ After tap ]
  "Every path through the Grid is watched."
  [View Language in CraftLingua →]   ← deepLinkUrl
```

**Notes:**
- Render the conlang string in a monospace font for a cipher aesthetic
- Embed `shareCode` invisibly on the card; surface it only via the "View Language" link
- For Master+ couriers with a linked CraftLingua account see Mechanic 4

---

## Mechanic 3 — District Vocabulary Graffiti Tags

**Concept:** Collectible in-world graffiti tags on board decks and district map views are
written in the district's conlang. Collecting all tags for a district unlocks a "Linguist" badge.
Tags can be pre-generated — no per-request API calls needed in production.

### Implementation steps

**Step 1 — Pre-generate vocabulary at build/deploy time**
```bash
curl https://craftlingua.app/api/public/district/airaway
```

**Response (excerpt):**
```json
{
  "districtName": "airaway",
  "languageName": "Airaway Slang",
  "vocabulary": {
    "run":     "exan",
    "network": "nexan",
    "data":    "bylan",
    "signal":  "siran",
    "code":    "bylan"
  },
  "shareCode": "eyJjcmFmdExpbmd1YVZlcnNpb24iOjEsIm5hbWUi..."
}
```

**Step 2 — Render 2-4 word tags per district**

Common skater phrases to pre-translate:
- "no path no problem" → `POST /api/public/translate` with `districtName: "airaway"`
- "grid runners never stop"
- "feel the flow"
- "run the signal"

Cache the results as static strings in your asset bundle.

**Step 3 — Attribution**
Each tag should include a small "Powered by CraftLingua" credit and optionally
a link to `https://craftlingua.app`.

**Fetch all districts in one call:**
```bash
curl https://craftlingua.app/api/public/districts
```

---

## Mechanic 4 — Personal Courier Language

**Concept:** Master and Legendary couriers whose player has a linked CraftLingua account
can encode a personal language onto their card. Faction chat messages appear in cipher to
other factions; allies see plain text.

This is the strongest conversion mechanic — it requires a CraftLingua Linguist or Archmage
subscription to create the language.

### Implementation steps

**Step 1 — Profile linking**
Add a "Link CraftLingua Language" input to PunchSkater profile settings.
Player pastes their CraftLingua share code (copied from the wizard share button).

```
courier.craftLinguaShareCode = "<paste from CraftLingua>"
```

**Step 2 — Faction chat encryption**
When this courier sends a faction chat message:
```bash
curl -X POST https://craftlingua.app/api/public/translate \
  -H "Content-Type: application/json" \
  -H "X-Partner-Key: $PUNCHSKATER_PARTNER_KEY" \
  -d "{\"text\": \"${message}\", \"languageParams\": ${langParamsFromShareCode}}"
```

To decode the languageParams from a share code:
```javascript
const decoded = JSON.parse(Buffer.from(shareCode.replace(/-/g,"+").replace(/_/g,"/"), "base64").toString());
const langParams = {
  phonemeStyle:   decoded.selections.phonemes,
  morphemeStyle:  decoded.selections.morphemes,
  lexemeStyle:    decoded.selections.lexemes,
  semanticStyle:  decoded.selections.semantics,
  pragmaticStyle: decoded.selections.pragmatics,
};
```

**Step 3 — Message rendering**
- Same faction → display original message (plain text)
- Other faction → display `response.translated` (cipher)
- Hovering shows "Encoded in [courier name]'s personal language"

**Rate limit note:** This mechanic generates one API call per chat message per courier.
Apply a client-side rate limit (e.g. 1 encrypted message per 5 seconds) to stay within
the 60 req/min partner API limit.

---

## Mechanic 5 — Codex Language Library

**Concept:** A public page within PunchSkater's Codex shows all 6 canonical district languages,
their phoneme style, a sample sentence, and a "Build Your Own Language" CTA linking to craftlingua.app.

### Implementation steps

**Step 1 — Fetch all district cards at build/deploy time**
```bash
curl https://craftlingua.app/api/public/districts
```

Cache the full response as a static JSON file in your build output.

**Step 2 — Render the Language Library page**

For each district card:
```
┌──────────────────────────────────────────────┐
│  🌆 Airaway Slang                              │
│  Harmonic · Isolating · Technology            │
│  "Run the signal through the network."         │
│  ────────────────────────────────────────     │
│  "Keth- eth-exan siran ra nexan -ven"          │  ← sampleConlang
│                                                │
│  [Explore This Language →]  [Build Your Own →] │
└──────────────────────────────────────────────┘
```

- "Explore This Language →" links to the district's `deepLinkUrl`
- "Build Your Own →" links to `https://craftlingua.app`
- Page is public/unauthenticated — drives organic traffic to CraftLingua

**Step 3 — Static caching**
The district API responses are deterministic (computed from fixed language params).
Re-fetch at most once per day or once per deploy.

---

## Rate Limits & Error Handling

| Endpoint | Auth | Rate Limit |
|---|---|---|
| `GET /api/public/district/:name` | None | No limit (cacheable) |
| `GET /api/public/districts` | None | No limit (cacheable) |
| `POST /api/public/translate` | X-Partner-Key | 60 req/min per IP |

**HTTP status codes:**
- `200` — Success
- `400` — Invalid request body (see `errors` field)
- `401` — Missing or invalid X-Partner-Key
- `404` — District name not found
- `429` — Rate limit exceeded (retry after 60 seconds)
- `500` — Internal server error

**Retry strategy for 429:**
```javascript
async function translateWithRetry(payload, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, { method: "POST", body: JSON.stringify(payload), headers });
    if (res.status !== 429) return res;
    await new Promise(r => setTimeout(r, 60_000 / maxAttempts * (attempt + 1)));
  }
}
```

---

## Environment Variables Required

| Variable | Description |
|---|---|
| `PUNCHSKATER_PARTNER_KEY` | Shared secret for `X-Partner-Key` header on translate endpoint |

Set in CraftLingua's environment secrets. Contact the SP Digital LLC platform team to obtain the key value.

---

## Attribution Requirements

When CraftLingua powers an in-game feature, include one of the following attributions:
- Text: "Powered by CraftLingua"
- Link: `https://craftlingua.app`
- Suggested placement: graffiti tag footer, card reverse, Codex Library page footer

---

## Contact

Both products are operated by SP Digital LLC. For partner API key rotation, rate limit increases,
or integration questions, coordinate internally.
