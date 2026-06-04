import type { Biome, Card, TerrainMod } from '../types.ts';

export function terrainMod(card: Card, biome: Biome): TerrainMod {
  if (card.homeBiomes.includes(biome)) {
    return { diceDelta: 2, reroll: true, abilityOn: true, classification: 'home' };
  }
  if (card.exposedBiomes.includes(biome)) {
    return { diceDelta: -1, reroll: false, abilityOn: false, classification: 'exposed' };
  }
  return { diceDelta: 0, reroll: false, abilityOn: true, classification: 'neutral' };
}

const WATER_BIOMES: ReadonlySet<Biome> = new Set(['Open Ocean', 'Deep Sea', 'Wetland/Mud']);

export function isWaterBiome(biome: Biome): boolean {
  return WATER_BIOMES.has(biome);
}
