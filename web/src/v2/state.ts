// Top-level state machine for the v0.2 hot-seat UI.
import type { GameState, PlayerId, Action, GameEvent } from '../../../src/game/index.ts';
import { applyAction, playerView } from '../../../src/game/index.ts';
import { strikeCommentary, winCommentary, type CommentaryInput } from './commentary.ts';
export { winCommentary };

export type Phase =
  | { kind: 'setup' }
  | { kind: 'pass-to-garrison'; player: PlayerId }
  | { kind: 'garrison'; player: PlayerId }
  | { kind: 'pass-to-turn'; player: PlayerId }
  | { kind: 'turn'; player: PlayerId; pendingResult?: ActionResult }
  | { kind: 'win'; winner: PlayerId; condition: 'glory' | 'endurance' | 'assassination' };

// What a just-played action produced — the "clean per-action output" cowork wants.
export type ActionResult = {
  title: string;            // "Sniff revealed" / "Strike resolved" / "Bluff called!"
  narration?: string;       // Initial Cassius line (the static fallback). Renders big + italic.
  liveInput?: CommentaryInput; // Optional: if set, ActionResult kicks off live commentate + swaps in.
  body: string[];           // 1-3 short detail lines (dice, costs, etc.)
  flavor?: 'good' | 'bad' | 'neutral' | 'spectacle';
};

export type AppState = {
  phase: Phase;
  game: GameState | null;
};

export function makeInitialState(): AppState {
  return { phase: { kind: 'setup' }, game: null };
}

// Apply an action through the engine + summarize the result for the panel.
export function runAction(
  game: GameState,
  player: PlayerId,
  action: Action,
  rand: () => number,
): { game: GameState; result: ActionResult } | { error: string } {
  const r = applyAction(game, player, action, rand);
  if (!r.ok) return { error: r.error };
  const newEvents = r.state.log.slice(game.log.length);
  return { game: r.state, result: summarize(action, newEvents, player, r.state) };
}

function summarize(action: Action, newEvents: GameEvent[], asker: PlayerId, _state: GameState): ActionResult {
  // Build a player-perspective summary from the freshly added events.
  switch (action.kind) {
    case 'Garrison': {
      const ev = newEvents.find((e) => e.t === 'garrison');
      if (ev?.t !== 'garrison') return { title: 'Garrisoned', body: [] };
      const lines = [`Placed face-down at arena ${ev.arena + 1}.`];
      if (action.declaration) lines.push(`Declared: "${action.declaration}"`);
      if (action.placeAce) lines.push(`★ Ace tucked under this garrison.`);
      return { title: 'Garrisoned', body: lines, flavor: 'neutral' };
    }
    case 'Scout': {
      const result = newEvents.find((e) => e.t === 'scout-result-private');
      if (result?.t !== 'scout-result-private') return { title: 'Scouted', body: [] };
      const cost = (newEvents.find((e) => e.t === 'scout') as Extract<GameEvent, { t: 'scout' }> | undefined)?.cost ?? 0;
      const lines = [`Cost: ${cost} scout token${cost === 1 ? '' : 's'}.`];
      if (result.result.kind === 'Sniff') lines.push(`Tags revealed: [${result.result.tags.join(', ') || 'none'}]`);
      if (result.result.kind === 'Probe') lines.push(`Probe "${result.result.query}" → ${result.result.answer ? 'YES' : 'no'}`);
      if (result.result.kind === 'DeepScout') lines.push(`Card revealed: ${result.result.cardName}`);
      return { title: 'Scout', body: lines, flavor: 'neutral' };
    }
    case 'Strike': {
      const strikeEv = newEvents.find((e) => e.t === 'strike');
      const resultEv = newEvents.find((e) => e.t === 'strike-result');
      if (strikeEv?.t !== 'strike' || resultEv?.t !== 'strike-result') return { title: 'Strike', body: [] };
      const att = strikeEv.attackerName;
      const def = strikeEv.defenderName;
      const arenaBiome = _state.arenas[strikeEv.arena]!.biome;
      const salt = (resultEv.aHits + 1) * 17 + (resultEv.bHits + 1) * 23 + strikeEv.arena * 31 + _state.log.length;
      const liveInput: CommentaryInput = {
        strikeReq: strikeEv,
        strikeResult: resultEv,
        biome: arenaBiome,
        attackerName: att,
        defenderName: def,
        attackerTags: resultEv.attackerTags,
      };
      const narration = strikeCommentary(liveInput, salt);
      const details: string[] = [];
      // v0.3: render the round-by-round bout sequence so multi-round is visible
      // (cowork e9f2970f). For empty-arena strikes rounds[] is empty.
      if (def !== null && resultEv.rounds && resultEv.rounds.length > 0) {
        details.push(`— ${resultEv.roundsFought}-round bout —`);
        for (const rd of resultEv.rounds) {
          const aMark = rd.aStaminaAfter <= 0 ? `S${rd.aStaminaAfter} ✗BURNED` : `S${rd.aStaminaAfter}`;
          const bMark = rd.bStaminaAfter <= 0 ? `S${rd.bStaminaAfter} ✗BURNED` : `S${rd.bStaminaAfter}`;
          const tag = rd.roundWinner === 'tie' ? ' (clinch)' : (rd.roundWinner === resultEv.attacker ? ` (${att} wins)` : ` (${def} wins)`);
          details.push(`Round ${rd.round}: ${att} ${rd.aHits} / ${def} ${rd.bHits}${tag} → ${att} ${aMark} · ${def} ${bMark}`);
        }
      }
      if (resultEv.winner === 'draw') {
        details.push(`💥 MUTUAL DESTRUCTION — both critters burned, the arena is cleared.`);
      } else if (resultEv.winner === 'tie' && def !== null) {
        details.push(`⏳ 12-round cap — draw by exhaustion. ${att} retreats; ${def} holds the arena.`);
      } else if (resultEv.burned.length > 0) {
        details.push(`Burned: ${resultEv.burned.join(', ')}.`);
      }
      if (resultEv.aceBurned) {
        details.push(`🦂 ACE BURNED — opponent's hidden champion is now revealed and the rest of their critters are exposed.`);
      }
      const flavor: NonNullable<ActionResult['flavor']> = resultEv.aceBurned
        ? 'spectacle'
        : (resultEv.winner === asker ? 'good' : (resultEv.winner === 'tie' ? 'neutral' : 'bad'));
      const title = resultEv.aceBurned
        ? '🦂 ASSASSINATION'
        : (resultEv.winner === 'tie'
          ? `Bounce — ${arenaBiome}`
          : (def === null
            ? `Banner planted at ${arenaBiome}`
            : `${arenaBiome} — ${resultEv.winner === asker ? 'You win' : 'You lose'}`));
      return { title, narration, liveInput, body: details, flavor };
    }
    case 'Redeploy': {
      return { title: 'Redeployed', body: [`Moved garrison; Dug-In bonus lost.`], flavor: 'neutral' };
    }
    case 'Declare': {
      return { title: 'Declared', body: [`You publicly named arena ${action.arena + 1} as "${action.declaration}".`], flavor: 'neutral' };
    }
    case 'Call': {
      const callEv = newEvents.find((e) => e.t === 'call');
      if (callEv?.t !== 'call') return { title: 'Call', body: [] };
      const lines: string[] = [];
      if (callEv.wasTrue) {
        lines.push(`They told the truth — penalty: −1 scout token + 1 garrison revealed.`);
        return { title: 'Bluff called: TRUTH', body: lines, flavor: 'bad' };
      } else {
        lines.push(`Bluff! That garrison burns and you take the arena.`);
        return { title: 'Bluff called: LIE', body: lines, flavor: 'spectacle' };
      }
    }
    case 'EndTurn': {
      const drew = newEvents.some((e) => e.t === 'draw');
      const body = drew
        ? [`Drew 1 card.`]
        : [`No draw (hand at cap of ${_state.config.handCap}).`];
      return { title: 'Turn ended', body, flavor: 'neutral' };
    }
  }
}

export { playerView };
