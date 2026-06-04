import type { Biome, Card, Creature } from '../types.ts';
import { BIOMES } from '../types.ts';

// MIGHT/STAMINA derivation curve (proposal v0.1 — needs cowork sign-off).
// Per spec + cowork anchors: Tardigrade 2/9, Peregrine 4/4, Slime Mold 1/9, Raven 3/6.
//   - might from power-score quintiles in [2..4]
//   - stamina inverse to might (max - might + 5), with tag mods:
//     [Unbroken]/[Regenerate] +2, [Armor] +1, [Flyer] −1.
// Creatures with mightOverride/staminaOverride bypass the curve (used by the
// starter 8 to print exactly the paper rules; the curve is for the long tail
// and for `generateCard` outputs). Slime Mold's power_score is null by design
// and MUST be hand-statted via override.

const POWER_QUINTILES = [25, 40, 55, 70]; // inclusive upper bounds for quintile buckets 1..4
// (q5 = above 70). Buckets map: q1→2, q2→2, q3→3, q4→3, q5→4 might.
// Tuned to hit Peregrine (power ~62 → q4 → 3) — but Peregrine printed at 4.
// Override carries the printed value; the curve is the long-tail prior.

function mightFromPower(power: number | null): number {
  if (power === null) return 2;
  let bucket = 5;
  for (let i = 0; i < POWER_QUINTILES.length; i++) {
    if (power <= POWER_QUINTILES[i]!) {
      bucket = i + 1;
      break;
    }
  }
  // q1:2 q2:2 q3:3 q4:3 q5:4
  if (bucket <= 2) return 2;
  if (bucket <= 4) return 3;
  return 4;
}

function staminaFromMight(might: number, tags: Creature['tags']): number {
  // Glass-cannon ↔ tank inverse: base = 9 - might. Anchor: might 4 → 5, might 3 → 6, might 2 → 7.
  let stam = 9 - might;
  if (tags.includes('Unbroken') || tags.includes('Regenerate')) stam += 2;
  if (tags.includes('Armor')) stam += 1;
  if (tags.includes('Flyer')) stam -= 1;
  return Math.max(1, stam);
}

export function deriveCard(creature: Creature): Card {
  const might = creature.mightOverride ?? mightFromPower(creature.power_score);
  const baseStamina = creature.staminaOverride ?? staminaFromMight(might, creature.tags);

  const homeBiomes: Biome[] = [];
  const exposedBiomes: Biome[] = [];

  const unbroken = creature.tags.includes('Unbroken');

  // [Unbroken] flat profile: no Home stars, no Exposed.
  // (Open design Q to cowork: spec says "homeBiomes = affinity ≥ 8". Tardigrade
  // has all 10 affinities = 8, which would make every biome Home, contradicting
  // the printed card's "Home ★ none". Treating [Unbroken] as "no Home, no
  // Exposed" matches the paper game; pending sign-off.)
  if (!unbroken) {
    for (const biome of BIOMES) {
      const aff = creature.affinity[biome];
      if (aff >= 8) homeBiomes.push(biome);
      if (aff <= 2) exposedBiomes.push(biome);
    }
  }

  return {
    creature,
    might,
    stamina: baseStamina,
    homeBiomes,
    exposedBiomes,
  };
}
