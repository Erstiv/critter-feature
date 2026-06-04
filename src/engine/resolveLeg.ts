import type { Ability, Biome, Card, Effect, LegResult, Tag } from '../types.ts';
import { terrainMod, isWaterBiome } from './terrainMod.ts';
import { rollStrike, abilityFiresInBiome } from './rollStrike.ts';

// Per-side mutable state during a leg.
type Side = {
  card: Card;
  isChallenger: boolean;
  stamina: number;
  abilityOn: boolean;
  abilitiesFiredThisBout: Set<string>;
};

// Compute the effective ability bundle for the side this leg.
// - Skip if abilityOn is false (Exposed).
// - Skip if biome restriction fails.
// - Skip if condition (isChallenger) fails.
// - Skip active abilities that are oncePerBout and already fired.
// - Skip if opponent carries a tag in nullVs (handled at *application* time for
//   target=opponent effects; passive self-mods still apply).
function shouldFireAbility(
  ability: Ability,
  side: Side,
  biome: Biome
): { fires: boolean; reason?: string } {
  // [Mindless] bypasses Exposed→ability-OFF (precedent rule 3: psychological
  // effects need a nervous system; Exposed is a behavioral suppression, so
  // brainless creatures shrug it off). Optimal Path on Slime Mold relies on this.
  const mindless = side.card.creature.tags.includes('Mindless');
  if (!side.abilityOn && !mindless) return { fires: false, reason: 'Exposed (ability OFF)' };
  if (!abilityFiresInBiome(ability, biome, isWaterBiome(biome))) {
    return { fires: false, reason: `not in ${ability.biome ?? 'biome'}` };
  }
  if (ability.condition === 'isChallenger' && !side.isChallenger) {
    return { fires: false, reason: 'not the Challenger this leg' };
  }
  if (ability.oncePerBout && side.abilitiesFiredThisBout.has(ability.name)) {
    return { fires: false, reason: 'already fired this bout' };
  }
  if (ability.trigger === 'active' && side.stamina <= ability.cost) {
    return { fires: false, reason: `cannot pay ${ability.cost} stamina (have ${side.stamina})` };
  }
  return { fires: true };
}

function targetIsNullified(ability: Ability, defenderTags: ReadonlyArray<Tag>): boolean {
  for (const t of ability.nullVs) {
    if (defenderTags.includes(t)) return true;
  }
  return false;
}

export type LegOpts = {
  a: Card;
  b: Card;
  biome: Biome;
  challenger: 'a' | 'b';
  aStartStamina: number;
  bStartStamina: number;
  aFiredThisBout: Set<string>;
  bFiredThisBout: Set<string>;
  aOptions?: { swapBiomeAvailable: boolean };
  bOptions?: { swapBiomeAvailable: boolean };
  rand: () => number;
};

export type LegOutcome = {
  result: LegResult;
  aEndStamina: number;
  bEndStamina: number;
};

export function resolveLeg(opts: LegOpts): LegOutcome {
  const { a, b, biome, challenger, rand } = opts;
  const log: string[] = [];

  const aMod = terrainMod(a, biome);
  const bMod = terrainMod(b, biome);

  log.push(`— Leg in ${biome} — Challenger: ${challenger === 'a' ? a.creature.name : b.creature.name}`);
  log.push(
    `  ${a.creature.name}: ${aMod.classification.toUpperCase()} (dice ${aMod.diceDelta >= 0 ? '+' : ''}${aMod.diceDelta}, ` +
      `reroll=${aMod.reroll}, ability=${aMod.abilityOn ? 'ON' : 'OFF'})`
  );
  log.push(
    `  ${b.creature.name}: ${bMod.classification.toUpperCase()} (dice ${bMod.diceDelta >= 0 ? '+' : ''}${bMod.diceDelta}, ` +
      `reroll=${bMod.reroll}, ability=${bMod.abilityOn ? 'ON' : 'OFF'})`
  );

  const aSide: Side = {
    card: a,
    isChallenger: challenger === 'a',
    stamina: opts.aStartStamina,
    abilityOn: aMod.abilityOn,
    abilitiesFiredThisBout: opts.aFiredThisBout,
  };
  const bSide: Side = {
    card: b,
    isChallenger: challenger === 'b',
    stamina: opts.bStartStamina,
    abilityOn: bMod.abilityOn,
    abilitiesFiredThisBout: opts.bFiredThisBout,
  };

  // ABILITY GATE.
  // Each side checks its ability. Passives auto-fire if eligible; actives auto-fire
  // for the M0 smoke (heuristic: always fire if affordable + useful). The CLI/AI
  // layer at M2 will replace the auto-trigger heuristic with a real chooser.
  function maybeFire(side: Side, defender: Side): {
    fired: boolean;
    nullified: boolean;
    selfDiceDelta: number;
    opponentDiceDelta: number;
    selfRefaces: { from: number; to: number }[];
    selfExtraReroll: boolean;
    selfIgnoreHits: number;
    selfAutoHits: number;
    selfFightAsHome: boolean;
    staminaTaxPerHit: number;
    immune: Tag[];
    capHits: number | null;
    floorStamina: number;
    log: string[];
  } {
    const acc = {
      fired: false,
      nullified: false,
      selfDiceDelta: 0,
      opponentDiceDelta: 0,
      selfRefaces: [] as { from: number; to: number }[],
      selfExtraReroll: false,
      selfIgnoreHits: 0,
      selfAutoHits: 0,
      selfFightAsHome: false,
      staminaTaxPerHit: 0,
      immune: [] as Tag[],
      capHits: null as number | null,
      floorStamina: 0,
      log: [] as string[],
    };
    const ab = side.card.creature.ability;
    const decision = shouldFireAbility(ab, side, biome);
    if (!decision.fires) {
      acc.log.push(`${side.card.creature.name}: ability "${ab.name}" did NOT fire — ${decision.reason}`);
      return acc;
    }

    const nullified = targetIsNullified(ab, defender.card.creature.tags);
    if (nullified && ab.effects.some((e) => isOpponentTargeting(e))) {
      acc.fired = true;
      acc.nullified = true;
      acc.log.push(
        `${side.card.creature.name}: ability "${ab.name}" NULLIFIED — ${defender.card.creature.name} carries [${defender.card.creature.tags.filter((t) => ab.nullVs.includes(t)).join(', ')}]`
      );
      // null abilities still pay no cost (they bounce harmlessly).
      return acc;
    }

    if (ab.trigger === 'active') {
      side.stamina -= ab.cost;
      acc.log.push(`${side.card.creature.name} pays ${ab.cost} stamina for "${ab.name}" (→${side.stamina})`);
    }
    if (ab.oncePerBout) side.abilitiesFiredThisBout.add(ab.name);
    acc.fired = true;

    for (const e of ab.effects) {
      applyEffect(e, acc, side, defender);
    }
    acc.log.push(`${side.card.creature.name}: "${ab.name}" fires (${ab.effects.map((e) => e.verb).join(', ')})`);
    return acc;
  }

  const aFire = maybeFire(aSide, bSide);
  const bFire = maybeFire(bSide, aSide);
  log.push(...aFire.log, ...bFire.log);

  // Compose dice counts.
  const aMight = a.might;
  const bMight = b.might;
  const aDice = Math.max(0, aMight + aMod.diceDelta + aFire.selfDiceDelta + (aFire.selfFightAsHome && aMod.classification !== 'home' ? 2 : 0) + bFire.opponentDiceDelta);
  const bDice = Math.max(0, bMight + bMod.diceDelta + bFire.selfDiceDelta + (bFire.selfFightAsHome && bMod.classification !== 'home' ? 2 : 0) + aFire.opponentDiceDelta);

  const aCanReroll = aMod.reroll || aFire.selfExtraReroll || (aFire.selfFightAsHome && !aMod.reroll);
  const bCanReroll = bMod.reroll || bFire.selfExtraReroll || (bFire.selfFightAsHome && !bMod.reroll);

  log.push(`  ${a.creature.name} rolls ${aDice}d6 (reroll=${aCanReroll})`);
  const aStrike = rollStrike({ diceCount: aDice, canReroll: aCanReroll, refaces: aFire.selfRefaces, rand });
  for (const l of aStrike.log) log.push(`    ${a.creature.name}: ${l}`);

  log.push(`  ${b.creature.name} rolls ${bDice}d6 (reroll=${bCanReroll})`);
  const bStrike = rollStrike({ diceCount: bDice, canReroll: bCanReroll, refaces: bFire.selfRefaces, rand });
  for (const l of bStrike.log) log.push(`    ${b.creature.name}: ${l}`);

  let aHits = aStrike.hits + aFire.selfAutoHits;
  let bHits = bStrike.hits + bFire.selfAutoHits;
  if (aFire.selfAutoHits) log.push(`  ${a.creature.name}: +${aFire.selfAutoHits} auto-hit`);
  if (bFire.selfAutoHits) log.push(`  ${b.creature.name}: +${bFire.selfAutoHits} auto-hit`);

  // CapHits — creature's hits this leg are bounded (e.g. Slime Mold's Optimal Path).
  if (aFire.capHits !== null && aHits > aFire.capHits) {
    log.push(`  ${a.creature.name}: CapHits caps ${aHits} → ${aFire.capHits}`);
    aHits = aFire.capHits;
  }
  if (bFire.capHits !== null && bHits > bFire.capHits) {
    log.push(`  ${b.creature.name}: CapHits caps ${bHits} → ${bFire.capHits}`);
    bHits = bFire.capHits;
  }

  // Armor / IgnoreHits — defender drops incoming.
  if (bFire.selfIgnoreHits > 0) {
    const ignored = Math.min(bFire.selfIgnoreHits, aHits);
    aHits -= ignored;
    log.push(`  ${b.creature.name}: IgnoreHits absorbs ${ignored}`);
  }
  if (aFire.selfIgnoreHits > 0) {
    const ignored = Math.min(aFire.selfIgnoreHits, bHits);
    bHits -= ignored;
    log.push(`  ${a.creature.name}: IgnoreHits absorbs ${ignored}`);
  }

  log.push(`  HITS — ${a.creature.name}: ${aHits} | ${b.creature.name}: ${bHits}`);

  // Wound: loser of the leg loses 1 stamina.
  let aStaminaDelta = 0;
  let bStaminaDelta = 0;
  let winner: string | null = null;
  if (aHits > bHits) {
    winner = a.creature.name;
    bStaminaDelta -= 1;
  } else if (bHits > aHits) {
    winner = b.creature.name;
    aStaminaDelta -= 1;
  } else {
    // Tie — both lose 1; leg re-rolls (caller handles re-roll loop if desired).
    aStaminaDelta -= 1;
    bStaminaDelta -= 1;
    log.push(`  TIE — both lose 1 stamina; leg should re-roll`);
  }

  // StaminaTax — attacker pays per Hit dealt to taxer.
  // Tardigrade's Cryptobiosis: every Hit dealt to it costs the attacker 1 stamina.
  if (aFire.staminaTaxPerHit > 0 && aHits < bHits) {
    // Attacker (b) dealt some hits to a. Tax those hits.
    const tax = bHits * aFire.staminaTaxPerHit;
    bStaminaDelta -= tax;
    log.push(`  ${a.creature.name}: StaminaTax — ${b.creature.name} pays ${tax} for ${bHits} hits dealt`);
  }
  if (aFire.staminaTaxPerHit > 0 && bHits > 0 && aHits >= bHits) {
    // Even if attacker lost the leg, the hits they DID land still trigger tax.
    const tax = bHits * aFire.staminaTaxPerHit;
    bStaminaDelta -= tax;
    log.push(`  ${a.creature.name}: StaminaTax — ${b.creature.name} pays ${tax} for ${bHits} hits dealt`);
  }
  if (bFire.staminaTaxPerHit > 0) {
    const tax = aHits * bFire.staminaTaxPerHit;
    aStaminaDelta -= tax;
    if (tax > 0) log.push(`  ${b.creature.name}: StaminaTax — ${a.creature.name} pays ${tax} for ${aHits} hits dealt`);
  }

  let aEnd = opts.aStartStamina + aStaminaDelta;
  let bEnd = opts.bStartStamina + bStaminaDelta;

  // FloorStamina — Hits can't drop you below the floor (Slime Mold's Optimal Path).
  // Applied to leg-end stamina; covers both leg-wound damage and StaminaTax.
  if (aFire.floorStamina > 0 && aEnd < aFire.floorStamina) {
    log.push(`  ${a.creature.name}: FloorStamina(${aFire.floorStamina}) clamps ${aEnd} → ${aFire.floorStamina}`);
    aEnd = aFire.floorStamina;
  }
  if (bFire.floorStamina > 0 && bEnd < bFire.floorStamina) {
    log.push(`  ${b.creature.name}: FloorStamina(${bFire.floorStamina}) clamps ${bEnd} → ${bFire.floorStamina}`);
    bEnd = bFire.floorStamina;
  }

  return {
    result: {
      biome,
      challenger: challenger === 'a' ? a.creature.name : b.creature.name,
      aHits,
      bHits,
      winner,
      aStaminaDelta,
      bStaminaDelta,
      log,
    },
    aEndStamina: aEnd,
    bEndStamina: bEnd,
  };
}

function isOpponentTargeting(e: Effect): boolean {
  if (e.verb === 'ModifyDice' && e.target === 'opponent') return true;
  if (e.verb === 'DrainStamina') return true;
  return false;
}

// Accumulator type matches maybeFire's `acc` shape.
type EffectAcc = {
  selfDiceDelta: number;
  opponentDiceDelta: number;
  selfRefaces: { from: number; to: number }[];
  selfExtraReroll: boolean;
  selfIgnoreHits: number;
  selfAutoHits: number;
  selfFightAsHome: boolean;
  staminaTaxPerHit: number;
  immune: Tag[];
  capHits: number | null;
  floorStamina: number;
  log: string[];
};
type SideRef = { card: Card; stamina: number };

function applyEffect(e: Effect, acc: EffectAcc, _self: SideRef, _opp: SideRef): void {
  switch (e.verb) {
    case 'ModifyDice':
      if (e.target === 'opponent') acc.opponentDiceDelta += e.n;
      else acc.selfDiceDelta += e.n;
      break;
    case 'Reroll':
      if (e.scope === 'all') acc.selfExtraReroll = true;
      // numeric scope: not used yet
      break;
    case 'Reface':
      acc.selfRefaces.push({ from: e.from, to: e.to });
      break;
    case 'IgnoreHits':
      acc.selfIgnoreHits += e.n;
      break;
    case 'DealAutoHit':
      acc.selfAutoHits += e.n;
      break;
    case 'StaminaTax':
      acc.staminaTaxPerHit += e.n;
      break;
    case 'DrainStamina':
      // Handled elsewhere (leg resolution); for M0 not wired.
      break;
    case 'FightAsHome':
      acc.selfFightAsHome = true;
      break;
    case 'CapHits':
      acc.capHits = acc.capHits === null ? e.n : Math.min(acc.capHits, e.n);
      break;
    case 'FloorStamina':
      acc.floorStamina = Math.max(acc.floorStamina, e.n);
      break;
    case 'SwapBiome':
      // Handled by the bout-level controller before this leg runs.
      break;
    case 'CopyForm':
      // Handled during card-derive (Mimic creatures); not in starter 8.
      break;
    case 'Immune':
      acc.immune.push(e.tag);
      break;
  }
}
