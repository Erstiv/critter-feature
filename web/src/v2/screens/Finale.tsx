// Match-end full-screen spectacle (cowork d4a5dc89 Q9).
// Cassius narration + winner in marquee + Ace unmask for assassination + Rematch CTA.

import { useEffect, useMemo, useState } from 'react';
import type { GameState, PlayerId, GameEvent } from '../../../../src/game/index.ts';
import { winCommentary } from '../commentary.ts';
import { commentateMatchEnd } from '../commentateClient.ts';

type Props = {
  game: GameState;
  winner: PlayerId;
  condition: 'glory' | 'endurance' | 'assassination';
  onRematch: () => void;
};

export function Finale({ game, winner, condition, onRematch }: Props) {
  const loser: PlayerId = winner === 'p1' ? 'p2' : 'p1';
  const winnerLabel = winner === 'p1' ? 'Player 1' : 'Player 2';
  const loserLabel = loser === 'p1' ? 'Player 1' : 'Player 2';

  // Pick the most-recent strike biome for the match-end line. Defaults to
  // "the bill" if no strike happened (e.g. endurance via deck exhaustion).
  const lastBiome = useMemo(() => {
    for (let i = game.log.length - 1; i >= 0; i--) {
      const e = game.log[i]!;
      if (e.t === 'strike') return game.arenas[e.arena]!.biome;
    }
    return 'the bill';
  }, [game.log, game.arenas]);

  const fallbackNarration = useMemo(() => {
    return winCommentary(condition, winnerLabel, loserLabel, game.log.length, lastBiome);
  }, [condition, winnerLabel, loserLabel, game.log.length, lastBiome]);

  // Live commentate — swap in if it arrives in budget.
  const [liveLines, setLiveLines] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const { live } = commentateMatchEnd(condition, winnerLabel, loserLabel, lastBiome, game.log.length);
    live.then((lines) => {
      if (!cancelled && lines && lines.length > 0) setLiveLines(lines);
    });
    return () => { cancelled = true; };
  }, [condition, winnerLabel, loserLabel, lastBiome, game.log.length]);

  const narration = liveLines ? liveLines.join(' ') : fallbackNarration;

  // Ace unmask: for assassination, surface the burned Ace's name from the log
  // (look for the most recent strike-result with aceBurned and find the burned name).
  const burnedAce = useMemo(() => {
    if (condition !== 'assassination') return null;
    for (let i = game.log.length - 1; i >= 0; i--) {
      const e: GameEvent = game.log[i]!;
      if (e.t === 'strike-result' && e.aceBurned) {
        // The burned name is the loser's; the loser of THAT strike is the bout-loser.
        const burnedName = e.burned[e.burned.length - 1] ?? '???';
        return burnedName;
      }
    }
    return null;
  }, [game.log, condition]);

  const conditionLabel = condition === 'glory'
    ? '🏴 Glory'
    : condition === 'endurance'
    ? '⏳ Endurance'
    : '🦂 Assassination';

  return (
    <div className="v2-finale">
      <p className="v2-finale-eyebrow">★ The Bill is Settled ★</p>

      <div className="v2-finale-banner">
        <h1>{winnerLabel} wins!</h1>
        <p>by {conditionLabel}</p>
      </div>

      <p className="v2-finale-narration">{narration}</p>

      {burnedAce && (
        <div className="v2-finale-unmask">
          <h3>★ The Ace Unmasked ★</h3>
          <p className="ace-name">{burnedAce}</p>
          <p className="ace-flavor">
            {loserLabel}'s hidden champion. Now you know.
          </p>
        </div>
      )}

      <div className="v2-finale-actions">
        <button onClick={onRematch}>Rematch ▸</button>
      </div>
    </div>
  );
}
