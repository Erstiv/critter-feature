// Win-condition checks (§8). Pure functions over GameState. Call after every
// action; if any condition fires, set state.winner + state.winCondition + push event.

import type { GameEvent, GameState, PlayerId } from './types.ts';
import { PLAYERS, otherPlayer } from './types.ts';

export type WinCheck = {
  winner: PlayerId;
  condition: 'glory' | 'endurance' | 'assassination';
};

// GLORY: a player holds majorityForGlory banners.
function checkGlory(state: GameState): WinCheck | null {
  const tally: Record<PlayerId, number> = { p1: 0, p2: 0 };
  for (const a of state.arenas) if (a.banner) tally[a.banner] += 1;
  for (const p of PLAYERS) {
    if (tally[p] >= state.config.majorityForGlory) {
      return { winner: p, condition: 'glory' };
    }
  }
  return null;
}

// ENDURANCE: a player cannot field a critter (hand + deck + garrisons all gone).
function checkEndurance(state: GameState): WinCheck | null {
  for (const p of PLAYERS) {
    const ps = state.players[p];
    const garrCount = state.garrisons.filter((g) => g.owner === p).length;
    if (ps.hand.length === 0 && ps.deck.length === 0 && garrCount === 0) {
      return { winner: otherPlayer(p), condition: 'endurance' };
    }
  }
  return null;
}

// ASSASSINATION: a player burned the opponent's Ace this turn (latest strike-result event).
// (The Ace-burn payoff has already fired in strike.ts; this just declares the win.)
function checkAssassination(state: GameState): WinCheck | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i]!;
    if (e.t === 'strike-result' && e.aceBurned) {
      // Spec §8 says "Assassination" is a win path; §7 frames it as "usually game-deciding"
      // (not auto-win), so this returns the win only when the AceBurn ALSO leaves the
      // victim unable to recover within X turns. For v0.2 alpha + per cowork "typically
      // the finishing blow", treat Ace-burn as the winning blow. TBD(cowork-Q? — surface
      // as v0.2 balance Q during paper test).
      const winner = e.winner === 'tie' ? null : (e.winner as PlayerId | null);
      if (winner) return { winner, condition: 'assassination' };
    }
    if (e.t === 'turn-start') break;  // only check this turn's events
  }
  return null;
}

export function checkAllWinConditions(state: GameState): WinCheck | null {
  return checkAssassination(state) ?? checkGlory(state) ?? checkEndurance(state);
}

// Mutate state to record the win if any condition fires.
export function settleWin(state: GameState): GameState {
  if (state.winner) return state;
  const result = checkAllWinConditions(state);
  if (!result) return state;
  const ev: GameEvent = { t: 'win', player: result.winner, condition: result.condition };
  return {
    ...state,
    winner: result.winner,
    winCondition: result.condition,
    log: [...state.log, ev],
  };
}
