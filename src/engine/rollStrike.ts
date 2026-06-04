import type { Ability, Effect } from '../types.ts';
import { rollD6 } from './rng.ts';

// d6 → Hits: 4-5 = 1, 6 = 2, 1-3 = miss
export function dieToHits(face: number, refaces: { from: number; to: number }[]): number {
  let v = face;
  for (const r of refaces) {
    if (v === r.from) {
      v = r.to;
      break;
    }
  }
  if (v === 6) return 2;
  if (v === 4 || v === 5) return 1;
  if (v === 3) return 1; // From-the-Dark / similar refaces handled above; only "real" face 3 misses
  return 0;
}

// Cleaner: scoring function used post-refaces.
function faceToHits(face: number): number {
  if (face >= 6) return 2;
  if (face >= 4) return 1;
  return 0;
}

export type StrikeOpts = {
  diceCount: number;
  canReroll: boolean;
  refaces?: { from: number; to: number }[];
  rand: () => number;
};

export type StrikeOutcome = {
  rolled: number[];
  refaced: number[]; // faces after reface effects
  rerolled?: number[];
  finalFaces: number[];
  hits: number;
  log: string[];
};

export function rollStrike(opts: StrikeOpts): StrikeOutcome {
  const log: string[] = [];
  const refaces = opts.refaces ?? [];

  const rolled: number[] = [];
  for (let i = 0; i < opts.diceCount; i++) rolled.push(rollD6(opts.rand));
  log.push(`rolled [${rolled.join(', ')}] (${opts.diceCount}d6)`);

  // Apply refaces (e.g., Stoop: 6→3, From-the-Dark: 3→1).
  const refaced = rolled.map((f) => {
    for (const r of refaces) if (f === r.from) return r.to;
    return f;
  });
  if (refaces.length) log.push(`refaced → [${refaced.join(', ')}] (${refaces.map((r) => `${r.from}→${r.to}`).join(', ')})`);

  let finalFaces = refaced.slice();

  // Greedy reroll: reroll any die scoring 0 hits (misses), once.
  // Spec: "reroll once if allowed" — the table-game reroll is player-choice; for the
  // smoke we reroll misses (the dominant correct play). Refaces re-apply after reroll.
  let rerolled: number[] | undefined;
  if (opts.canReroll) {
    const indices = finalFaces.map((f, i) => (faceToHits(f) === 0 ? i : -1)).filter((i) => i >= 0);
    if (indices.length) {
      rerolled = [];
      for (const i of indices) {
        const newRoll = rollD6(opts.rand);
        rerolled.push(newRoll);
        let v = newRoll;
        for (const r of refaces) if (v === r.from) { v = r.to; break; }
        finalFaces[i] = v;
      }
      log.push(`reroll misses → [${rerolled.join(', ')}] (final faces [${finalFaces.join(', ')}])`);
    }
  }

  let hits = 0;
  for (const f of finalFaces) hits += faceToHits(f);
  log.push(`hits = ${hits}`);

  const out: StrikeOutcome = {
    rolled,
    refaced,
    finalFaces,
    hits,
    log,
  };
  if (rerolled) out.rerolled = rerolled;
  return out;
}

// Helper: pull `Reface` effects out of an active ability bundle that has fired.
export function refacesFromEffects(effects: Effect[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (const e of effects) if (e.verb === 'Reface') out.push({ from: e.from, to: e.to });
  return out;
}

export function abilityFiresInBiome(ability: Ability, biome: string, isWater: boolean): boolean {
  if (!ability.biome) return true;
  if (ability.biome === 'Water') return isWater;
  return ability.biome === biome;
}
