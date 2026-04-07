### How to Implement These Files

To set this up in your [Punch-Skater repository](https://github.com/driver727-pixel/Punch-Skater), you should create or update these three files inside the `src/lib/` directory. 

1.  **`src/lib/types.ts`**: Save this first. It defines the "shape" of your data (Factions, Districts, etc.) and ensures the other files follow the rules of the [Skater Punk doc](https://docs.google.com/document/d/16pxUvBdtA6rDoL2IG6jlDxOwAjFO3WNVmfqG9SzfT4c/edit?tab=t.0).
2.  **`src/lib/lore.ts`**: Save this second. It holds the actual lists of names, abilities, and flavor text.
3.  **`src/lib/generator.ts`**: Save this last. It is the "engine" that imports the types and lore to create a random character.

---

### 1. `src/lib/types.ts`
Replace the contents of your [types.ts](https://github.com/driver727-pixel/Punch-Skater/blob/main/src/lib/types.ts) with this:

```typescript
/**
 * types.ts
 * Unified Type Definitions for Punch-Skater.
 */

export type Faction = 
  | "United Corporations of America (UCA)"
  | "Qu111s (Quills)"
  | "Ne0n Legion"
  | "Iron Curtains" 
  | "D4rk $pider"
  | "The Asclepians"
  | "The Mesopotamian Society"
  | "The Knights Technarchy"
  | "Hermes' Squirmies"
  | "UCPS Workers"
  | "Moonrisers"
  | "The Wooders"
  | "Punch Skaters";

export type Manufacturer = 
  | "UCA" 
  | "DIY/Plywood" 
  | "The Wooders" 
  | "Dark Light Labs" 
  | "Asclepian Medical" 
  | "VoidRacer";

export type District = 
  | "Airaway" 
  | "The Roads" 
  | "Batteryville" 
  | "The Grid" 
  | "Electropolis" 
  | "Nightshade" 
  | "The Forest"
  | "Glass City";

export interface CardPayload {
  id: string;
  name: string;
  crew: Faction;
  district: District;
  manufacturer: Manufacturer;
  passiveTrait: string;
  activeAbility: string;
  flavorText: string;
  tags: string[];
}
