// The Strike action — the v0.2 game loop's combat trigger.
//
// Flow (§5):
//   1. Attacker commits a critter (from hand OR an adjacent garrison) on an arena.
//   2. Defender's garrison there (if any) is revealed; else attacker plants banner.
//   3. Engine's resolveLeg runs as a single best-of-1 clash in that biome.
//   4. Dug-In defender: +2 dice + ambush (TBD-cowork-Q7: defender wins ties + free reroll).
//   5. Loser BURNS. Winner takes banner + 1 wound (winnerWoundsPerStrike).
//   6. Ace burned → §7 payoff: victim reveals all garrisons + attacker plants free banner.

import { deriveCard } from '../engine/deriveCard.ts';
import { resolveLeg } from '../engine/resolveLeg.ts';
import type {
  Action,
  GameState,
  Garrison,
  PlayerId,
} from './types.ts';
import { otherPlayer } from './types.ts';
import { burnGarrison } from './actions.ts';

type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: {
      p1: { ...s.players.p1, deck: s.players.p1.deck.slice(), hand: s.players.p1.hand.slice(), discard: s.players.p1.discard.slice() },
      p2: { ...s.players.p2, deck: s.players.p2.deck.slice(), hand: s.players.p2.hand.slice(), discard: s.players.p2.discard.slice() },
    },
    arenas: s.arenas.map((a) => ({ ...a, garrisons: { ...a.garrisons } })),
    garrisons: s.garrisons.map((g) => ({ ...g })),
    log: s.log.slice(),
  };
}

let strikeGarrisonSeq = 0;
function mintStrikeGarrisonId(player: PlayerId): string {
  strikeGarrisonSeq += 1;
  return `gs-${player}-${strikeGarrisonSeq}`;
}

export function applyStrike(
  state: GameState,
  attacker: PlayerId,
  action: Extract<Action, { kind: 'Strike' }>,
  rand: () => number,
): ApplyResult {
  const defender = otherPlayer(attacker);
  const targetArena = state.arenas[action.targetArena];
  if (!targetArena) return { ok: false, error: 'target arena out of range' };
  const biomeOf = (i: number) => state.arenas[i]?.biome ?? `arena ${i}`;

  // Source the attacking garrison.
  const ns = cloneState(state);
  let attackingGarrison: Garrison;

  if (action.sourceArena === 'hand') {
    if (!action.sourceCardName) return { ok: false, error: 'strike from hand requires sourceCardName' };
    const me = ns.players[attacker];
    const idx = me.hand.findIndex((c) => c.name === action.sourceCardName);
    if (idx === -1) return { ok: false, error: `${action.sourceCardName} not in ${attacker}'s hand` };
    const creature = me.hand[idx]!;
    me.hand.splice(idx, 1);
    attackingGarrison = {
      id: mintStrikeGarrisonId(attacker),
      owner: attacker,
      card: deriveCard(creature),
      arena: action.targetArena,
      hidden: false,
      dugIn: false,   // committed this turn → no ambush bonus
      isAce: false,
      woundOffset: 0,
    };
    // Don't add to ns.garrisons yet — only stays alive if it wins.
  } else {
    const srcArena = ns.arenas[action.sourceArena];
    if (!srcArena) return { ok: false, error: 'source arena out of range' };
    const g = srcArena.garrisons[attacker];
    if (!g) return { ok: false, error: `You don't have a critter at ${biomeOf(action.sourceArena)} anymore.` };
    attackingGarrison = ns.garrisons.find((x) => x.id === g.id)!;
    // Cowork 01dc9dec Q1: contested-arena strikes ALLOWED. If the source IS the
    // target (your occupant attacking the opponent's co-garrison), the critter
    // stays in place — it doesn't leave its arena.
    if (action.sourceArena === action.targetArena) {
      // The pre-placed-but-attacking critter forfeits the lying-in-wait edge:
      // dugIn flag stays as it is for stamina tracking but we explicitly DON'T
      // forward it as a Dug-In bonus (handled below in defenderBonusDice).
      attackingGarrison.hidden = false;   // strike reveals
    } else {
      // The attacking garrison leaves its source arena to swing toward target.
      ns.arenas[action.sourceArena]!.garrisons[attacker] = null;
      attackingGarrison.arena = action.targetArena;
      attackingGarrison.hidden = false;
    }
  }

  const defGarrison = targetArena.garrisons[defender];

  // Empty arena → plant banner uncontested. Attacker garrisons (if from hand)
  // becomes a new garrison there, NOT dug-in this turn.
  if (!defGarrison) {
    if (action.sourceArena === 'hand') {
      ns.garrisons.push(attackingGarrison);
      ns.arenas[action.targetArena]!.garrisons[attacker] = attackingGarrison;
    } else {
      ns.arenas[action.targetArena]!.garrisons[attacker] = attackingGarrison;
    }
    ns.arenas[action.targetArena]!.banner = attacker;
    ns.arenas[action.targetArena]!.bannerProvenance = 'strike';   // banner D
    ns.log.push({
      t: 'strike',
      attacker, defender, arena: action.targetArena,
      attackerName: attackingGarrison.card.creature.name,
      defenderName: null,
    });
    ns.log.push({
      t: 'strike-result',
      attacker, defender, arena: action.targetArena,
      winner: attacker,
      aHits: 0, bHits: 0,
      burned: [],
      bannerOwner: attacker,
      aceBurned: false,
      legLog: ['empty arena — banner planted'],
      rounds: [],
      roundsFought: 0,
      attackerName: attackingGarrison.card.creature.name,
      attackerTags: attackingGarrison.card.creature.tags,
      attackerMight: attackingGarrison.card.might,
      attackerStamina: attackingGarrison.card.stamina,
      defenderName: null,
      defenderTags: null,
    });
    ns.actionTakenThisTurn = true;
    return { ok: true, state: ns };
  }

  // Defender garrison is revealed.
  const defenderGarr = ns.garrisons.find((x) => x.id === defGarrison.id)!;
  defenderGarr.hidden = false;

  // Compose cards reflecting wound erosion.
  const attackerCard = { ...attackingGarrison.card, stamina: Math.max(0, attackingGarrison.card.stamina - attackingGarrison.woundOffset) };
  const defenderCard = { ...defenderGarr.card, stamina: Math.max(0, defenderGarr.card.stamina - defenderGarr.woundOffset) };

  // Dug-In (§5.4, cowork ce5b3456 Q7) + Ace die bonus (§7) flow through the engine
  // as additive dice opts — no more Might-inflation.
  const defenderDugIn = defenderGarr.dugIn;
  const defenderBonusDice =
    (defenderDugIn ? ns.config.dugInDiceBonus : 0) +
    (defenderGarr.isAce ? ns.config.aceDieBonus : 0);

  ns.log.push({
    t: 'strike',
    attacker, defender, arena: action.targetArena,
    attackerName: attackingGarrison.card.creature.name,
    defenderName: defenderGarr.card.creature.name,
  });

  // v0.3 MULTI-ROUND CLASH (cowork e02f0692 / spec
  // CritterFeature_v0.3_MultiRound_Clash_Spec.md). Bout fought round-by-round
  // until KO, mutual destruction, or 12-round safety cap.
  const ROUND_CAP = 12;
  const aFired = new Set<string>();
  const bFired = new Set<string>();
  let aStamina = attackerCard.stamina;
  let bStamina = defenderCard.stamina;
  const rounds: Array<{ round: number; aHits: number; bHits: number; aStaminaAfter: number; bStaminaAfter: number; roundWinner: PlayerId | 'tie' }> = [];
  const legLog: string[] = [];
  let outcome: 'attacker-ko' | 'defender-ko' | 'mutual' | 'cap' = 'cap';

  for (let r = 1; r <= ROUND_CAP; r++) {
    const out = resolveLeg({
      a: { ...attackerCard, stamina: aStamina },
      b: { ...defenderCard, stamina: bStamina },
      biome: targetArena.biome,
      challenger: 'a',
      aStartStamina: aStamina,
      bStartStamina: bStamina,
      aFiredThisBout: aFired,
      bFiredThisBout: bFired,
      bDugInDice: defenderBonusDice,
      rand,
    });
    legLog.push(`-- round ${r} --`);
    legLog.push(...out.result.log);

    // resolveLeg returns aStaminaDelta/bStaminaDelta that already include the
    // -1 round-loser wound + any per-effect drain (Cryptobiosis StaminaTax,
    // etc.). For v0.3 we want stronger: round loser loses Stamina = hit MARGIN.
    // The engine's old delta was margin-agnostic (-1), so we apply our own
    // post-resolveLeg adjustment based on the hits.
    const aHits = out.result.aHits;
    const bHits = out.result.bHits;
    let roundWinner: PlayerId | 'tie';
    if (aHits > bHits) {
      const margin = Math.max(1, aHits - bHits);
      bStamina -= margin;
      roundWinner = attacker;
    } else if (bHits > aHits) {
      const margin = Math.max(1, bHits - aHits);
      aStamina -= margin;
      roundWinner = defender;
    } else {
      // Tie / clinch: both -1 (the round's "wound to each").
      aStamina -= 1;
      bStamina -= 1;
      roundWinner = 'tie';
    }
    // Apply additional per-effect drain (StaminaTax etc.) that resolveLeg
    // computed on top of its old -1 wound — the engine returned the delta
    // including that -1, so we subtract 1 to isolate the "extra" tax.
    const aExtra = out.result.aStaminaDelta - (aHits < bHits ? -1 : (aHits === bHits ? -1 : 0));
    const bExtra = out.result.bStaminaDelta - (bHits < aHits ? -1 : (aHits === bHits ? -1 : 0));
    aStamina += aExtra;
    bStamina += bExtra;
    aStamina = Math.max(-99, aStamina);
    bStamina = Math.max(-99, bStamina);
    rounds.push({ round: r, aHits, bHits, aStaminaAfter: Math.max(0, aStamina), bStaminaAfter: Math.max(0, bStamina), roundWinner });
    legLog.push(`   stamina after: ${attackingGarrison.card.creature.name}=${Math.max(0,aStamina)} ${defenderGarr.card.creature.name}=${Math.max(0,bStamina)}`);

    const aDead = aStamina <= 0;
    const bDead = bStamina <= 0;
    if (aDead && bDead) { outcome = 'mutual'; break; }
    if (aDead) { outcome = 'attacker-ko'; break; }   // attacker (a) died → defender wins
    if (bDead) { outcome = 'defender-ko'; break; }   // defender (b) died → attacker wins
  }

  const lastRound = rounds[rounds.length - 1]!;
  // Persist wounds on the survivor (if any). Wounds = card stamina - current.
  let winnerSide: PlayerId | 'tie' | 'draw';
  if (outcome === 'attacker-ko') {
    // Attacker dead → DEFENDER wins. Defender carries accumulated wounds.
    winnerSide = defender;
    defenderGarr.woundOffset = defenderGarr.card.stamina - Math.max(0, bStamina);
  } else if (outcome === 'defender-ko') {
    // Defender dead → ATTACKER wins. Attacker carries accumulated wounds.
    winnerSide = attacker;
    attackingGarrison.woundOffset = attackingGarrison.card.stamina - Math.max(0, aStamina);
  } else if (outcome === 'mutual') {
    winnerSide = 'draw';
  } else {
    // 12-round cap → DRAW by exhaustion: attacker retreats, defender holds, both wounded.
    winnerSide = 'tie';
    defenderGarr.woundOffset = defenderGarr.card.stamina - Math.max(0, bStamina);
    attackingGarrison.woundOffset = attackingGarrison.card.stamina - Math.max(0, aStamina);
  }

  let burnedNames: string[] = [];
  let aceBurned = false;
  let bannerOwner: PlayerId | null = ns.arenas[action.targetArena]!.banner;

  // Build a fake `out` object so the existing post-resolution code below can use
  // aHits/bHits + log without further surgery. winnerSide is set above.
  const out = { result: { aHits: lastRound.aHits, bHits: lastRound.bHits, log: legLog, aStaminaDelta: 0, bStaminaDelta: 0 } };

  if (winnerSide === attacker) {
    // Defender burns. Wound on the surviving attacker is already accumulated
    // from the round-by-round bleed (woundOffset set above to reflect remaining
    // stamina), so no additional +1 wound.
    const burnInfo = burnGarrison(ns, defenderGarr);
    burnedNames.push(defenderGarr.card.creature.name);
    if (burnInfo.aceBurned) aceBurned = true;
    if (action.sourceArena === 'hand') {
      ns.garrisons.push(attackingGarrison);
      ns.arenas[action.targetArena]!.garrisons[attacker] = attackingGarrison;
    } else {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        ns.arenas[action.targetArena]!.garrisons[attacker] = existing;
      }
    }
    ns.arenas[action.targetArena]!.banner = attacker;
    ns.arenas[action.targetArena]!.bannerProvenance = 'strike';
    bannerOwner = attacker;
  } else if (winnerSide === defender) {
    // Attacker burns. Defender's wound accumulated from rounds.
    if (action.sourceArena !== 'hand') {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        burnedNames.push(existing.card.creature.name);
        const info = burnGarrison(ns, existing);
        if (info.aceBurned) aceBurned = true;
      }
    } else {
      ns.players[attacker].discard.push(attackingGarrison.card.creature);
      burnedNames.push(attackingGarrison.card.creature.name);
    }
    if (ns.arenas[action.targetArena]!.banner === null) ns.arenas[action.targetArena]!.banner = defender;
    if (ns.arenas[action.targetArena]!.banner === defender) {
      ns.arenas[action.targetArena]!.bannerProvenance = 'strike';
    }
    bannerOwner = ns.arenas[action.targetArena]!.banner;
  } else if (winnerSide === 'draw') {
    // v0.3 mutual destruction: both hit 0 in the same round. Both burn, arena
    // cleared (including any banner).
    const defInfo = burnGarrison(ns, defenderGarr);
    burnedNames.push(defenderGarr.card.creature.name);
    if (defInfo.aceBurned) aceBurned = true;
    if (action.sourceArena !== 'hand') {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        burnedNames.push(existing.card.creature.name);
        const info = burnGarrison(ns, existing);
        if (info.aceBurned) aceBurned = true;
      }
    } else {
      ns.players[attacker].discard.push(attackingGarrison.card.creature);
      burnedNames.push(attackingGarrison.card.creature.name);
    }
    ns.arenas[action.targetArena]!.banner = null;
    ns.arenas[action.targetArena]!.bannerProvenance = null;
    bannerOwner = null;
  } else {
    // 12-round cap — draw by exhaustion. Attacker retreats to source, defender
    // holds. Both keep their accumulated wounds (set above).
    if (action.sourceArena === 'hand') {
      ns.players[attacker].hand.push(attackingGarrison.card.creature);
    } else {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        existing.arena = action.sourceArena;
        ns.arenas[action.sourceArena]!.garrisons[attacker] = existing;
      }
    }
    bannerOwner = ns.arenas[action.targetArena]!.banner;
  }

  // §7 — Ace burn payoff: reveal ALL victim garrisons + attacker plants ONE free banner.
  if (aceBurned && ns.config.aceBurnRevealsAll) {
    const victim = winnerSide === attacker ? defender : attacker;
    for (const g of ns.garrisons) if (g.owner === victim) g.hidden = false;
    if (ns.config.aceBurnGrantsFreeBanner && winnerSide === attacker) {
      // The UI will choose which arena gets the free banner; for headless, pick the
      // lowest-index arena the attacker doesn't already control.
      const candidate = ns.arenas.find((a) => a.banner !== attacker);
      if (candidate) {
        candidate.banner = attacker;
        candidate.bannerProvenance = 'strike';  // Ace-burn payoff counts as strike-won
      }
    }
  }

  ns.log.push({
    t: 'strike-result',
    attacker, defender, arena: action.targetArena,
    winner: winnerSide,
    aHits: out.result.aHits, bHits: out.result.bHits,
    burned: burnedNames,
    bannerOwner,
    aceBurned,
    legLog: out.result.log,
    rounds,
    roundsFought: rounds.length,
    attackerName: attackingGarrison.card.creature.name,
    attackerTags: attackingGarrison.card.creature.tags,
    attackerMight: attackingGarrison.card.might,
    attackerStamina: attackingGarrison.card.stamina,
    defenderName: defenderGarr.card.creature.name,
    defenderTags: defenderGarr.card.creature.tags,
  });
  ns.actionTakenThisTurn = true;
  return { ok: true, state: ns };
}
