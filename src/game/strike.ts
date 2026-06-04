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
  if (!targetArena) return { ok: false, error: 'arena out of range' };

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
    if (!srcArena) return { ok: false, error: 'sourceArena out of range' };
    const g = srcArena.garrisons[attacker];
    if (!g) return { ok: false, error: `no ${attacker} garrison at sourceArena ${action.sourceArena}` };
    // §5.1 "from hand, or an adjacent garrison" — enforce adjacency.
    if (Math.abs(action.sourceArena - action.targetArena) !== 1) {
      return { ok: false, error: 'strike from garrison must target an adjacent arena (TBD-cowork-Q8)' };
    }
    attackingGarrison = ns.garrisons.find((x) => x.id === g.id)!;
    // The attacking garrison leaves its source arena to swing.
    ns.arenas[action.sourceArena]!.garrisons[attacker] = null;
    attackingGarrison.arena = action.targetArena;
    attackingGarrison.hidden = false;   // strike reveals
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

  // Compose modified cards reflecting wound erosion + Ace die bonus + Dug-In.
  // Engine wants `Card` with might/stamina; we patch a copy.
  const attackerCard = { ...attackingGarrison.card, stamina: Math.max(0, attackingGarrison.card.stamina - attackingGarrison.woundOffset) };
  const defenderCard = { ...defenderGarr.card, stamina: Math.max(0, defenderGarr.card.stamina - defenderGarr.woundOffset) };

  // Dug-In: §5.4 = +2 dice and ambush. Until cowork-Q7 lands, "ambush" =
  // ns.config.dugInWinsTies (tie-break to defender) + ns.config.dugInFreeReroll.
  const defenderDugIn = defenderGarr.dugIn;
  // Engine doesn't yet have an aDugIn/bDugIn opt; until we add it (additive change,
  // pending cowork-Q7 ratification), we encode the Dug-In bonus by inflating
  // defender's effective Might for the leg.
  if (defenderDugIn) {
    defenderCard.might += ns.config.dugInDiceBonus;
  }
  // Ace die bonus: §7 — defending Ace gets +1 die.
  if (defenderGarr.isAce) {
    defenderCard.might += ns.config.aceDieBonus;
  }

  const out = resolveLeg({
    a: attackerCard,
    b: defenderCard,
    biome: targetArena.biome,
    challenger: 'a',     // attacker is the Challenger this strike
    aStartStamina: attackerCard.stamina,
    bStartStamina: defenderCard.stamina,
    aFiredThisBout: new Set(),
    bFiredThisBout: new Set(),
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
    // §5 — best-of-1; TBD(cowork-Q1). If dugInWinsTies + defender is Dug-In, defender wins.
    if (defenderDugIn && ns.config.dugInWinsTies) {
      winnerSide = defender;
      ns.log.push({ t: 'strike-result', attacker, defender, arena: action.targetArena,
        winner: 'tie', aHits: out.result.aHits, bHits: out.result.bHits,
        burned: [], bannerOwner, aceBurned: false, legLog: ['tie → defender Dug-In tie-break'] });
    } else {
      // Punt: both burn (option b). Cowork will clarify; this matches "mutual destruction" reading.
      winnerSide = 'tie';
    }
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
    // 'tie' fallthrough — both burn (TBD until cowork-Q1).
    burnedNames.push(attackingGarrison.card.creature.name);
    if (action.sourceArena !== 'hand') {
      const existing = ns.garrisons.find((x) => x.id === attackingGarrison.id);
      if (existing) {
        const info = burnGarrison(ns, existing);
        if (info.aceBurned) aceBurned = true;
      }
    } else {
      ns.players[attacker].discard.push(attackingGarrison.card.creature);
    }
    burnedNames.push(defenderGarr.card.creature.name);
    const info = burnGarrison(ns, defenderGarr);
    if (info.aceBurned) aceBurned = true;
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
