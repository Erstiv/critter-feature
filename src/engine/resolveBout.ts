import type { Biome, BoutResult, Card, LegResult } from '../types.ts';
import { resolveLeg } from './resolveLeg.ts';

export type BoutOpts = {
  a: Card;
  b: Card;
  // Terrain picks per leg. Leg 1 = a's pick, Leg 2 = b's pick, Leg 3 = neutral.
  // If terrainPicks is shorter than 3, missing legs default to neutral (pre-picked or random).
  terrainPicks: Biome[];
  // Starting challenger: spec says high die roll → Challenger; Leg 1 = P1 picks
  // (i.e. challenger picks). For determinism we accept it as an arg.
  firstChallenger?: 'a' | 'b';
  legs?: number; // override for smoke/single-leg test; default = best-of-3
  rand: () => number;
};

export function resolveBout(opts: BoutOpts): BoutResult {
  const a = opts.a;
  const b = opts.b;
  const legs: LegResult[] = [];
  const log: string[] = [];

  let aStam = a.stamina;
  let bStam = b.stamina;
  let aWins = 0;
  let bWins = 0;

  const aFired = new Set<string>();
  const bFired = new Set<string>();

  const totalLegs = opts.legs ?? 3;
  let challenger: 'a' | 'b' = opts.firstChallenger ?? 'a';

  log.push(`=== BOUT: ${a.creature.name} (${aStam} stam, ${a.might} might) vs ${b.creature.name} (${bStam} stam, ${b.might} might) ===`);

  for (let i = 0; i < totalLegs; i++) {
    if (aStam <= 0 || bStam <= 0) break;
    const biome = opts.terrainPicks[i] ?? opts.terrainPicks[opts.terrainPicks.length - 1] ?? 'Plains';

    const out = resolveLeg({
      a,
      b,
      biome,
      challenger,
      aStartStamina: aStam,
      bStartStamina: bStam,
      aFiredThisBout: aFired,
      bFiredThisBout: bFired,
      rand: opts.rand,
    });
    legs.push(out.result);
    log.push(`\n[Leg ${i + 1}]`);
    log.push(...out.result.log);

    aStam = Math.max(0, out.aEndStamina);
    bStam = Math.max(0, out.bEndStamina);

    if (out.result.winner === a.creature.name) aWins += 1;
    else if (out.result.winner === b.creature.name) bWins += 1;

    log.push(`  → Score: ${a.creature.name} ${aWins} — ${bWins} ${b.creature.name} | Stamina: ${aStam} / ${bStam}`);

    // Endurance KO check.
    if (aStam <= 0) {
      log.push(`\n>>> ENDURANCE KO — ${b.creature.name} wins (${a.creature.name} exhausted)`);
      return {
        a: a.creature.name,
        b: b.creature.name,
        legs,
        winner: b.creature.name,
        winType: 'endurance',
        aFinalStamina: aStam,
        bFinalStamina: bStam,
        log,
      };
    }
    if (bStam <= 0) {
      log.push(`\n>>> ENDURANCE KO — ${a.creature.name} wins (${b.creature.name} exhausted)`);
      return {
        a: a.creature.name,
        b: b.creature.name,
        legs,
        winner: a.creature.name,
        winType: 'endurance',
        aFinalStamina: aStam,
        bFinalStamina: bStam,
        log,
      };
    }

    // Glory KO check.
    if (aWins >= 2) {
      log.push(`\n>>> GLORY — ${a.creature.name} wins ${aWins}-${bWins}`);
      return {
        a: a.creature.name,
        b: b.creature.name,
        legs,
        winner: a.creature.name,
        winType: 'glory',
        aFinalStamina: aStam,
        bFinalStamina: bStam,
        log,
      };
    }
    if (bWins >= 2) {
      log.push(`\n>>> GLORY — ${b.creature.name} wins ${bWins}-${aWins}`);
      return {
        a: a.creature.name,
        b: b.creature.name,
        legs,
        winner: b.creature.name,
        winType: 'glory',
        aFinalStamina: aStam,
        bFinalStamina: bStam,
        log,
      };
    }

    // Challenger marker passes each Leg; Leg 3 is "neutral" (treated as next-pick here,
    // since terrainPicks[2] is the locked neutral biome — the caller chose it).
    challenger = challenger === 'a' ? 'b' : 'a';
  }

  // No KO in the configured legs — return whoever leads, or 'draw' as last-name fallback.
  if (totalLegs < 3) {
    log.push(`\n>>> SMOKE END — single leg run; score ${aWins}-${bWins}, stamina ${aStam}/${bStam}`);
    const winner =
      aWins > bWins ? a.creature.name : bWins > aWins ? b.creature.name : (legs[0]?.winner ?? a.creature.name);
    return {
      a: a.creature.name,
      b: b.creature.name,
      legs,
      winner,
      winType: 'glory',
      aFinalStamina: aStam,
      bFinalStamina: bStam,
      log,
    };
  }

  // Shouldn't reach here in best-of-3.
  log.push(`\n>>> Best-of-3 exhausted without a winner — unexpected state`);
  return {
    a: a.creature.name,
    b: b.creature.name,
    legs,
    winner: a.creature.name,
    winType: 'glory',
    aFinalStamina: aStam,
    bFinalStamina: bStam,
    log,
  };
}
