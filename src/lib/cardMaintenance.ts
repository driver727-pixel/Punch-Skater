import type { ForgedMaintenanceData, MaintenanceState, Rarity } from "./types";

export function getRepairMinutesForRarity(rarity: Rarity): number {
  switch (rarity) {
    case "Legendary": return 240;
    case "Rare":      return 90;
    case "Master":    return 45;
    case "Apprentice":
    case "Punch Skater":
    default:          return 15;
  }
}

export function getFastTrackCreditCost(rarity: Rarity): number {
  switch (rarity) {
    case "Legendary": return 500;
    case "Rare":      return 250;
    case "Master":    return 100;
    case "Apprentice": return 40;
    case "Punch Skater":
    default:          return 25;
  }
}

export function createDefaultMaintenance(rarity: Rarity): ForgedMaintenanceData {
  return {
    state: "active" as MaintenanceState,
    chargePct: 100,
    repairMinutes: getRepairMinutesForRarity(rarity),
    fastTrackCreditCost: getFastTrackCreditCost(rarity),
  };
}
