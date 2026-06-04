import type { Biome, BoutResult, Card, LegResult } from '../types.ts';
import { BIOMES } from '../types.ts';
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

    // Tie re-roll loop: paper rule says "Tie = both lose 1 Stamina, re-roll the
    // Leg." Each tie wound takes effect (already applied by resolveLeg as the
    // -1/-1 stamina delta), then we re-resolve a fresh leg with the post-tie
    // stamina. Endurance KO can fire mid-tie.
    let out = resolveLeg({
      a, b, biome, challenger,
      aStartStamina: aStam, bStartStamina: bStam,
      aFiredThisBout: aFired, bFiredThisBout: bFired,
      rand: opts.rand,
    });
    legs.push(out.result);
    log.push(`\n[Leg ${i + 1}]`);
    log.push(...out.result.log);
    aStam = Math.max(0, out.aEndStamina);
    bStam = Math.max(0, out.bEndStamina);

    let tieReRoll = 0;
    while (out.result.winner === null && aStam > 0 && bStam > 0 && tieReRoll < 5) {
      tieReRoll += 1;
      log.push(`\n[Leg ${i + 1} — tie re-roll #${tieReRoll}]`);
      out = resolveLeg({
        a, b, biome, challenger,
        aStartStamina: aStam, bStartStamina: bStam,
        aFiredThisBout: aFired, bFiredThisBout: bFired,
        rand: opts.rand,
      });
      legs.push(out.result);
      log.push(...out.result.log);
      aStam = Math.max(0, out.aEndStamina);
      bStam = Math.max(0, out.bEndStamina);
    }
    if (tieReRoll >= 5 && out.result.winner === null) {
      log.push(`  TIE RE-ROLL LIMIT (5) — leg unresolved, no leg-win awarded`);
    }

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

  // STALEMATE TIEBREAKER (cowork ratification b8ea916c):
  // After 3 legs with neither a Glory (2 wins) nor an Endurance KO (0 stam),
  // most stamina remaining at Leg 3 end takes Glory. Still tied → sudden-death
  // re-roll in a fresh neutral biome (one not yet used in this bout). Endurance
  // KO can still fire during sudden death.
  if (aStam > bStam) {
    log.push(`\n>>> STALEMATE — ${a.creature.name} takes Glory by stamina (${aStam} vs ${bStam})`);
    return { a: a.creature.name, b: b.creature.name, legs, winner: a.creature.name, winType: 'glory', aFinalStamina: aStam, bFinalStamina: bStam, log };
  }
  if (bStam > aStam) {
    log.push(`\n>>> STALEMATE — ${b.creature.name} takes Glory by stamina (${bStam} vs ${aStam})`);
    return { a: a.creature.name, b: b.creature.name, legs, winner: b.creature.name, winType: 'glory', aFinalStamina: aStam, bFinalStamina: bStam, log };
  }

  // True stalemate — equal stamina. Sudden-death re-roll in a fresh neutral biome.
  const used = new Set<Biome>(opts.terrainPicks.slice(0, 3));
  const candidates = BIOMES.filter((b) => !used.has(b));
  const sdBiome: Biome = (candidates.length ? candidates[Math.floor(opts.rand() * candidates.length)]! : 'Plains') as Biome;
  log.push(`\n[Sudden Death — fresh neutral biome: ${sdBiome}]`);
  const sd = resolveLeg({
    a, b, biome: sdBiome,
    challenger: 'a',
    aStartStamina: aStam, bStartStamina: bStam,
    aFiredThisBout: aFired, bFiredThisBout: bFired,
    rand: opts.rand,
  });
  legs.push(sd.result);
  log.push(...sd.result.log);
  aStam = Math.max(0, sd.aEndStamina);
  bStam = Math.max(0, sd.bEndStamina);
  if (aStam <= 0 && bStam > 0) {
    log.push(`\n>>> SUDDEN-DEATH ENDURANCE KO — ${b.creature.name} wins`);
    return { a: a.creature.name, b: b.creature.name, legs, winner: b.creature.name, winType: 'endurance', aFinalStamina: aStam, bFinalStamina: bStam, log };
  }
  if (bStam <= 0 && aStam > 0) {
    log.push(`\n>>> SUDDEN-DEATH ENDURANCE KO — ${a.creature.name} wins`);
    return { a: a.creature.name, b: b.creature.name, legs, winner: a.creature.name, winType: 'endurance', aFinalStamina: aStam, bFinalStamina: bStam, log };
  }
  const sdWinner = sd.result.winner ?? (aStam >= bStam ? a.creature.name : b.creature.name);
  log.push(`\n>>> SUDDEN-DEATH GLORY — ${sdWinner} wins`);
  return { a: a.creature.name, b: b.creature.name, legs, winner: sdWinner, winType: 'glory', aFinalStamina: aStam, bFinalStamina: bStam, log };
}
