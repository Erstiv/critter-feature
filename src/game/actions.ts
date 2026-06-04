// Turn state machine — pure action handlers. Each one validates, mutates a
// shallow clone of state, and emits public + private events. The Strike action
// lives in strike.ts because it calls into the engine's resolveLeg.

import { deriveCard } from '../engine/deriveCard.ts';
import type { Creature } from '../types.ts';
import {
  type Action,
  type GameState,
  type Garrison,
  type GarrisonView,
  type PlayerId,
  type ScoutKind,
  type ScoutResult,
  type GameEvent,
  MIND_RECON,
  SCOUT_COST,
  otherPlayer,
} from './types.ts';

type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

// Clone state shallowly enough to add new events / mutate top-level arrays.
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

let garrisonSeq = 0;
function mintGarrisonId(player: PlayerId): string {
  garrisonSeq += 1;
  return `g-${player}-${garrisonSeq}`;
}

// ──────────────────────────────────────────────────────────────────────
// GARRISON
// ──────────────────────────────────────────────────────────────────────

function applyGarrison(state: GameState, player: PlayerId, action: Extract<Action, { kind: 'Garrison' }>): ApplyResult {
  const me = state.players[player];
  const idx = me.hand.findIndex((c) => c.name === action.cardName);
  if (idx === -1) return { ok: false, error: `${action.cardName} not in ${player}'s hand` };
  const arena = state.arenas[action.arena];
  if (!arena) return { ok: false, error: `arena ${action.arena} out of range` };
  if (arena.garrisons[player]) return { ok: false, error: `${player} already occupies arena ${action.arena}` };

  const creature = me.hand[idx]!;
  const ns = cloneState(state);
  ns.players[player].hand.splice(idx, 1);

  const garrison: Garrison = {
    id: mintGarrisonId(player),
    owner: player,
    card: deriveCard(creature),
    arena: action.arena,
    hidden: true,
    dugIn: false,
    isAce: !!action.placeAce,
    woundOffset: 0,
  };
  if (action.declaration !== undefined) {
    garrison.declaration = action.declaration;
    garrison.declaredTrue = action.declaration === creature.name;
  }

  ns.garrisons.push(garrison);
  ns.arenas[action.arena]!.garrisons[player] = garrison;

  if (action.placeAce) ns.players[player].aceGarrisonId = garrison.id;

  const ev: GameEvent = { t: 'garrison', player, arena: action.arena };
  if (action.declaration !== undefined) ev.declared = action.declaration;
  ns.log.push(ev);
  if (action.declaration !== undefined) {
    ns.log.push({ t: 'declare', player, arena: action.arena, declaration: action.declaration });
  }

  ns.actionTakenThisTurn = true;
  return { ok: true, state: ns };
}

// ──────────────────────────────────────────────────────────────────────
// SCOUT
// ──────────────────────────────────────────────────────────────────────

// Compute effective scout cost for asker, given their [Mind] critters in play.
export function effectiveScoutCost(state: GameState, asker: PlayerId, kind: ScoutKind): { cost: number; usedFreeSniff: boolean } {
  const me = state.players[asker];
  const inPlay = state.garrisons.filter((g) => g.owner === asker);
  let usedFreeSniff = false;
  let cost = SCOUT_COST[kind];

  // Free sniff (Octopus) consumes the per-turn freebie before tokens.
  if (kind === 'Sniff' && me.freeSniffsRemaining > 0) {
    cost = 0;
    usedFreeSniff = true;
  }

  // (Future: probeCostOverride / deepScoutCostOverride from other MIND_RECON entries.)
  for (const g of inPlay) {
    const bonus = MIND_RECON[g.card.creature.name];
    if (!bonus) continue;
    if (kind === 'Probe' && bonus.probeCostOverride !== undefined) cost = bonus.probeCostOverride;
    if (kind === 'DeepScout' && bonus.deepScoutCostOverride !== undefined) cost = bonus.deepScoutCostOverride;
  }
  return { cost, usedFreeSniff };
}

function sniffTagCount(state: GameState, asker: PlayerId): number {
  // Raven gives 2 tags per Sniff.
  const inPlay = state.garrisons.filter((g) => g.owner === asker);
  let count = 1;
  for (const g of inPlay) {
    const bonus = MIND_RECON[g.card.creature.name];
    if (bonus?.sniffRevealsTags !== undefined) count = Math.max(count, bonus.sniffRevealsTags);
  }
  return count;
}

function applyScout(state: GameState, asker: PlayerId, action: Extract<Action, { kind: 'Scout' }>): ApplyResult {
  const target = action.targetPlayer;
  if (target === asker) return { ok: false, error: 'cannot scout self' };
  const arena = state.arenas[action.targetArena];
  if (!arena) return { ok: false, error: `arena ${action.targetArena} out of range` };
  const targetGarrison = arena.garrisons[target];
  if (!targetGarrison) return { ok: false, error: `no ${target} garrison at arena ${action.targetArena}` };

  const { cost, usedFreeSniff } = effectiveScoutCost(state, asker, action.scoutKind);
  if (!usedFreeSniff && state.players[asker].scoutTokens < cost) {
    return { ok: false, error: `${asker} cannot afford ${action.scoutKind} (cost ${cost}, has ${state.players[asker].scoutTokens})` };
  }

  const ns = cloneState(state);
  if (usedFreeSniff) {
    ns.players[asker].freeSniffsRemaining -= 1;
  } else {
    ns.players[asker].scoutTokens -= cost;
  }

  let result: ScoutResult;
  switch (action.scoutKind) {
    case 'Sniff': {
      const n = sniffTagCount(state, asker);
      result = { kind: 'Sniff', tags: targetGarrison.card.creature.tags.slice(0, n) };
      break;
    }
    case 'Probe': {
      const q = action.probeQuery ?? '';
      let answer: boolean;
      // §6: "is this your Ace?" is a special-case query the defender must answer
      // truthfully. Other Probes ("is this Tardigrade?") are name checks.
      if (/^\s*is this your ace\s*\??$/i.test(q)) {
        answer = targetGarrison.isAce;
      } else {
        answer = targetGarrison.card.creature.name.toLowerCase() === q.toLowerCase();
      }
      result = { kind: 'Probe', query: q, answer };
      break;
    }
    case 'DeepScout': {
      result = { kind: 'DeepScout', cardName: targetGarrison.card.creature.name, card: targetGarrison.card };
      break;
    }
  }

  ns.log.push({
    t: 'scout',
    asker, target, arena: action.targetArena,
    kind: action.scoutKind,
    cost,
  });
  ns.log.push({ t: 'scout-result-private', asker, result });

  ns.actionTakenThisTurn = true;
  return { ok: true, state: ns };
}

// ──────────────────────────────────────────────────────────────────────
// REDEPLOY (§4) — move a garrison, lose Dug-In.
// TBD(cowork-227c338b/Q8): adjacency interpretation. Defaulting to linear-row
// adjacency: |from - to| === 1.
// ──────────────────────────────────────────────────────────────────────

function applyRedeploy(state: GameState, player: PlayerId, action: Extract<Action, { kind: 'Redeploy' }>): ApplyResult {
  const arenaFrom = state.arenas[action.fromArena];
  const arenaTo = state.arenas[action.toArena];
  if (!arenaFrom || !arenaTo) return { ok: false, error: 'arena out of range' };
  const g = arenaFrom.garrisons[player];
  if (!g) return { ok: false, error: `no ${player} garrison at arena ${action.fromArena}` };
  if (arenaTo.garrisons[player]) return { ok: false, error: `arena ${action.toArena} already occupied by ${player}` };
  // Cowork d4a5dc89 Q3: adjacency DROPPED for Redeploy/MOVE — go to any empty arena you own.

  const ns = cloneState(state);
  const newG = ns.garrisons.find((x) => x.id === g.id)!;
  newG.arena = action.toArena;
  newG.dugIn = false;       // §4: redeploy strips Dug-In
  // Cowork d4a5dc89 Q6: MOVE re-hides the garrison ("they slipped it back into the dark").
  newG.hidden = true;
  ns.arenas[action.fromArena]!.garrisons[player] = null;
  ns.arenas[action.toArena]!.garrisons[player] = newG;
  ns.log.push({ t: 'redeploy', player, from: action.fromArena, to: action.toArena });
  ns.actionTakenThisTurn = true;
  return { ok: true, state: ns };
}

// ──────────────────────────────────────────────────────────────────────
// DECLARE (§4) — free, public, refresh a declaration mid-bout.
// ──────────────────────────────────────────────────────────────────────

function applyDeclare(state: GameState, player: PlayerId, action: Extract<Action, { kind: 'Declare' }>): ApplyResult {
  const arena = state.arenas[action.arena];
  if (!arena) return { ok: false, error: 'arena out of range' };
  const g = arena.garrisons[player];
  if (!g) return { ok: false, error: `no ${player} garrison at arena ${action.arena}` };

  const ns = cloneState(state);
  const newG = ns.garrisons.find((x) => x.id === g.id)!;
  newG.declaration = action.declaration;
  newG.declaredTrue = action.declaration === newG.card.creature.name;
  ns.log.push({ t: 'declare', player, arena: action.arena, declaration: action.declaration });
  // §4: Declare is free — does NOT set actionTakenThisTurn.
  return { ok: true, state: ns };
}

// ──────────────────────────────────────────────────────────────────────
// CALL (§6) — free, public, swingy. Reveal vs prior declaration.
// ──────────────────────────────────────────────────────────────────────

function applyCall(state: GameState, caller: PlayerId, action: Extract<Action, { kind: 'Call' }>): ApplyResult {
  const target = action.targetPlayer;
  if (target === caller) return { ok: false, error: 'cannot call self' };
  const arena = state.arenas[action.targetArena];
  if (!arena) return { ok: false, error: 'arena out of range' };
  const g = arena.garrisons[target];
  if (!g) return { ok: false, error: `no ${target} garrison at arena ${action.targetArena}` };
  if (g.declaration === undefined) return { ok: false, error: 'no public declaration to call' };

  const ns = cloneState(state);
  const newG = ns.garrisons.find((x) => x.id === g.id)!;
  const wasTrue = !!newG.declaredTrue;

  if (!wasTrue) {
    // They lied → burn that garrison, caller takes the arena.
    burnGarrison(ns, newG);
    ns.arenas[action.targetArena]!.banner = caller;
    ns.log.push({
      t: 'call', caller, target, arena: action.targetArena,
      wasTrue: false, outcome: 'caller-wins-arena',
    });
  } else {
    // Truth → caller pays a token and reveals one of their own garrisons.
    ns.players[caller].scoutTokens = Math.max(0, ns.players[caller].scoutTokens - 1);
    // Reveal the caller's first hidden garrison (deterministic; UI may surface a chooser).
    const mine = ns.garrisons.find((x) => x.owner === caller && x.hidden);
    if (mine) {
      mine.hidden = false;
    }
    ns.log.push({
      t: 'call', caller, target, arena: action.targetArena,
      wasTrue: true, outcome: 'caller-loses-token-and-reveals',
    });
  }
  // Call is free → no actionTakenThisTurn flip.
  return { ok: true, state: ns };
}

// Helper: send a garrison to the discard, clear arena slot, mark Ace-burned if applicable.
export function burnGarrison(ns: GameState, g: Garrison): { aceBurned: boolean } {
  ns.players[g.owner].discard.push(g.card.creature);
  ns.arenas[g.arena]!.garrisons[g.owner] = null;
  const idx = ns.garrisons.findIndex((x) => x.id === g.id);
  if (idx >= 0) ns.garrisons.splice(idx, 1);
  const aceBurned = g.isAce;
  if (aceBurned) ns.players[g.owner].aceGarrisonId = null;
  return { aceBurned };
}

// ──────────────────────────────────────────────────────────────────────
// END TURN — advance state, do Dug-In, refill scouts, draw, set next player.
// ──────────────────────────────────────────────────────────────────────

function applyEndTurn(state: GameState, player: PlayerId): ApplyResult {
  if (!state.actionTakenThisTurn) {
    return { ok: false, error: 'must take an action before ending turn' };
  }
  const ns = cloneState(state);

  // Draw 1 toward hand cap, skip if deck empty.
  const me = ns.players[player];
  if (me.hand.length < ns.config.handCap && me.deck.length > 0) {
    const drawn = me.deck.shift()!;
    me.hand.push(drawn);
    ns.log.push({ t: 'draw', player, cards: 1 });
  }

  // §5.4 Dug-In: a garrison that's been in place for a full turn since placement
  // gets the bonus. Flip all of MY garrisons that aren't already dug-in.
  for (const g of ns.garrisons) {
    if (g.owner === player && !g.dugIn) g.dugIn = true;
  }

  ns.log.push({ t: 'turn-end', player });
  ns.activePlayer = otherPlayer(player);
  ns.turn += 1;
  ns.actionTakenThisTurn = false;

  // Refill the free-sniff per-turn bonus for the player whose turn STARTS next.
  refillFreeSniffs(ns, ns.activePlayer);

  ns.log.push({ t: 'turn-start', player: ns.activePlayer, turnNumber: ns.turn });
  return { ok: true, state: ns };
}

function refillFreeSniffs(ns: GameState, player: PlayerId): void {
  const inPlay = ns.garrisons.filter((g) => g.owner === player);
  let free = 0;
  for (const g of inPlay) {
    const bonus = MIND_RECON[g.card.creature.name];
    if (bonus?.freeSniffsPerTurn !== undefined) free += bonus.freeSniffsPerTurn;
  }
  ns.players[player].freeSniffsRemaining = free;
}

// ──────────────────────────────────────────────────────────────────────
// DISPATCH
// ──────────────────────────────────────────────────────────────────────

import { applyStrike } from './strike.ts';
import { settleWin } from './winConditions.ts';

export function applyAction(
  state: GameState,
  player: PlayerId,
  action: Action,
  rand?: () => number,
): ApplyResult {
  if (state.winner) return { ok: false, error: 'game is over' };
  if (state.activePlayer !== player) {
    // Calls are sometimes valid out of turn (§6 — opponent reacts to a declaration
    // made on the opponent's turn). For v0.2 alpha, restrict Calls to in-turn too;
    // can relax later.
    return { ok: false, error: `not ${player}'s turn` };
  }
  // Main actions (Garrison/Scout/Strike/Redeploy) require this is the first.
  const isMain = action.kind === 'Garrison' || action.kind === 'Scout' || action.kind === 'Strike' || action.kind === 'Redeploy';
  if (isMain && state.actionTakenThisTurn) {
    return { ok: false, error: 'main action already taken this turn' };
  }

  let result: ApplyResult;
  switch (action.kind) {
    case 'Garrison': result = applyGarrison(state, player, action); break;
    case 'Scout':    result = applyScout(state, player, action); break;
    case 'Strike':   result = applyStrike(state, player, action, rand ?? Math.random); break;
    case 'Redeploy': result = applyRedeploy(state, player, action); break;
    case 'Declare':  result = applyDeclare(state, player, action); break;
    case 'Call':     result = applyCall(state, player, action); break;
    case 'EndTurn':  result = applyEndTurn(state, player); break;
  }
  if (result.ok) result = { ok: true, state: settleWin(result.state) };
  return result;
}
