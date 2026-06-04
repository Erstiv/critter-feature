// Live Cassius client. Posts to /api/commentate; falls back to the static bank
// if the call takes too long or errors. Per spec: 2.5s budget, fallback renders
// instantly, live line REPLACES the fallback if it arrives in time.
//
// Returns a tuple: [immediateFallback, livePromise]. The caller renders the
// immediate value right now, and (if still mounted) swaps in the resolved
// live array when the promise resolves with one.

import { strikeCommentary, winCommentary, type CommentaryInput } from './commentary.ts';
import type { GameEvent } from '../../../src/game/index.ts';

const COMMENTATE_BUDGET_MS = 2500;
const ENDPOINT = '/api/commentate';

type StrikeResult = Extract<GameEvent, { t: 'strike-result' }>;
type StrikeReq = Extract<GameEvent, { t: 'strike' }>;

export type CommentateLiveInput = {
  event: 'decisive' | 'narrow' | 'tie-bounce' | 'empty' | 'ace-burn'
       | 'glory-end' | 'endurance-end' | 'assassination-end';
  attacker: { name: string; tags: string[]; might: number; stamina: number };
  loser: { name: string; tags: string[] } | null;
  biome: string;
  hitsFor: number;
  hitsAgainst: number;
  margin: number;
  aceBurned: boolean;
  winCondition: 'glory' | 'endurance' | 'assassination' | null;
  // v0.3 multi-round bout: per-round outcomes so Cassius can narrate a
  // blow-by-blow (cowork e9f2970f). Empty for empty-arena strikes.
  rounds?: Array<{
    round: number;
    attackerHits: number;
    defenderHits: number;
    attackerStaminaAfter: number;
    defenderStaminaAfter: number;
    roundWinner: 'attacker' | 'defender' | 'tie';
  }>;
  outcome?: 'attacker-wins' | 'defender-wins' | 'mutual-draw' | 'exhaustion-draw';
};

// Recent-lines buffer per session — keeps Cassius from repeating in a long match.
const recentLines: string[] = [];
function rememberLines(lines: string[]) {
  for (const l of lines) recentLines.push(l);
  while (recentLines.length > 8) recentLines.shift();
}

export function classifyEvent(input: { strikeReq: StrikeReq; strikeResult: StrikeResult }): CommentateLiveInput['event'] {
  const r = input.strikeResult;
  if (r.aceBurned) return 'ace-burn';
  if (input.strikeReq.defenderName === null) return 'empty';
  if (r.winner === 'tie') return 'tie-bounce';
  const margin = Math.abs(r.aHits - r.bHits);
  if (margin === 1) return 'narrow';
  return 'decisive';
}

// Live commentate call with budgeted fallback. Returns the fallback line
// immediately AND a promise for the live lines (if they arrive in time).
export function commentateStrike(
  input: CommentaryInput,
  salt: number,
): { fallback: string; live: Promise<string[] | null> } {
  const fallback = strikeCommentary(input, salt);
  const result = input.strikeResult;
  let outcome: CommentateLiveInput['outcome'];
  if (result.winner === 'draw') outcome = 'mutual-draw';
  else if (result.winner === 'tie') outcome = 'exhaustion-draw';
  else if (result.winner === result.attacker) outcome = 'attacker-wins';
  else outcome = 'defender-wins';
  const liveInput: CommentateLiveInput = {
    event: classifyEvent({ strikeReq: input.strikeReq, strikeResult: result }),
    attacker: {
      name: result.attackerName,
      tags: result.attackerTags ?? [],
      might: result.attackerMight,
      stamina: result.attackerStamina,
    },
    loser: input.defenderName ? { name: input.defenderName, tags: result.defenderTags ?? [] } : null,
    biome: input.biome,
    hitsFor: result.aHits,
    hitsAgainst: result.bHits,
    margin: Math.abs(result.aHits - result.bHits),
    aceBurned: result.aceBurned,
    winCondition: null,
    rounds: result.rounds.map((r) => ({
      round: r.round,
      attackerHits: r.aHits,
      defenderHits: r.bHits,
      attackerStaminaAfter: r.aStaminaAfter,
      defenderStaminaAfter: r.bStaminaAfter,
      roundWinner: r.roundWinner === 'tie' ? 'tie' : (r.roundWinner === result.attacker ? 'attacker' : 'defender'),
    })),
    outcome,
  };
  const live = fetchLive(liveInput, recentLines.slice());
  return { fallback, live };
}

export function commentateMatchEnd(
  condition: 'glory' | 'endurance' | 'assassination',
  winner: string,
  loser: string,
  biome: string,
  salt: number,
): { fallback: string; live: Promise<string[] | null> } {
  const fallback = winCommentary(condition, winner, loser, salt, biome);
  const event = condition === 'glory' ? 'glory-end' : condition === 'endurance' ? 'endurance-end' : 'assassination-end';
  const liveInput: CommentateLiveInput = {
    event,
    attacker: { name: winner, tags: [], might: 0, stamina: 0 },
    loser: { name: loser, tags: [] },
    biome,
    hitsFor: 0, hitsAgainst: 0, margin: 0,
    aceBurned: condition === 'assassination',
    winCondition: condition,
  };
  const live = fetchLive(liveInput, recentLines.slice());
  return { fallback, live };
}

async function fetchLive(input: CommentateLiveInput, recents: string[]): Promise<string[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), COMMENTATE_BUDGET_MS);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, recentLines: recents }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json() as { lines?: string[] };
    if (!j.lines || j.lines.length === 0) return null;
    rememberLines(j.lines);
    return j.lines;
  } catch {
    return null;
  }
}
