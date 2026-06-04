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

  const out = resolveLeg({
    a: attackerCard,
    b: defenderCard,
    biome: targetArena.biome,
    challenger: 'a',     // attacker is the Challenger this strike
    aStartStamina: attackerCard.stamina,
    bStartStamina: defenderCard.stamina,
    aFiredThisBout: new Set(),
    bFiredThisBout: new Set(),
    bDugInDice: defenderBonusDice,
    rand,
  });

  ns.log.push({
    t: 'strike',
    attacker, defender, arena: action.targetArena,
    attackerName: attackingGarrison.card.creature.name,
    defenderName: defenderGarr.card.creature.name,
  });

  let winnerSide: PlayerId | 'tie';
  let burnedNames: string[] = [];
  let aceBurned = false;
  let bannerOwner: PlayerId | null = ns.arenas[action.targetArena]!.banner;

  if (out.result.aHits > out.result.bHits) {
    winnerSide = attacker;
  } else if (out.result.bHits > out.result.aHits) {
    winnerSide = defender;
  } else {
    // Universal tie rule (cowork ce5b3456 Q1): attacker bounces back to source,
    // defender holds, NEITHER is wounded.
    winnerSide = 'tie';
  }

  if (winnerSide === attacker) {
    // Defender burns.
    const burnInfo = burnGarrison(ns, defenderGarr);
    burnedNames.push(defenderGarr.card.creature.name);
    if (burnInfo.aceBurned) aceBurned = true;
    // Place attacker (if from hand) into the arena; if from garrison, attacker is now there.
    if (action.sourceArena === 'hand') {
      ns.garrisons.push(attackingGarrison);
      ns.arenas[action.targetArena]!.garrisons[attacker] = attackingGarrison;
    } else {
      // attackingGarrison already updated above with arena = targetArena
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        ns.arenas[action.targetArena]!.garrisons[attacker] = existing;
        existing.woundOffset += ns.config.winnerWoundsPerStrike;
      }
    }
    if (action.sourceArena === 'hand') {
      attackingGarrison.woundOffset += ns.config.winnerWoundsPerStrike;
    }
    ns.arenas[action.targetArena]!.banner = attacker;
    bannerOwner = attacker;
  } else if (winnerSide === defender) {
    // Attacker burns.
    if (action.sourceArena !== 'hand') {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        burnedNames.push(existing.card.creature.name);
        const info = burnGarrison(ns, existing);
        if (info.aceBurned) aceBurned = true;
      }
    } else {
      // hand-source attacker that lost → goes to discard.
      ns.players[attacker].discard.push(attackingGarrison.card.creature);
      burnedNames.push(attackingGarrison.card.creature.name);
    }
    // Defender keeps arena (banner unchanged or planted if was empty).
    if (ns.arenas[action.targetArena]!.banner === null) ns.arenas[action.targetArena]!.banner = defender;
    defenderGarr.woundOffset += ns.config.winnerWoundsPerStrike;
    bannerOwner = ns.arenas[action.targetArena]!.banner;
  } else {
    // TIE — universal bounce. No burns, no wounds.
    if (action.sourceArena === 'hand') {
      // Attacker returns the card to hand (the strike action consumed it; restore it).
      ns.players[attacker].hand.push(attackingGarrison.card.creature);
    } else {
      // Attacker garrison bounces back to its source arena.
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        existing.arena = action.sourceArena;
        // Hidden status: it was revealed by the strike → stays revealed.
        ns.arenas[action.sourceArena]!.garrisons[attacker] = existing;
      }
    }
    // Defender stays put. Banner (if it was empty before, it stays empty; if defender
    // already had one, they keep it). For a contested-and-tied arena, no banner change.
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
      if (candidate) candidate.banner = attacker;
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
  });
  ns.actionTakenThisTurn = true;
  return { ok: true, state: ns };
}
