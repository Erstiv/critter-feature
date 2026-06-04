// Match-end full-screen spectacle (cowork d4a5dc89 Q9).
// Cassius narration + winner in marquee + Ace unmask for assassination + Rematch CTA.

import { useMemo } from 'react';
import type { GameState, PlayerId, GameEvent } from '../../../../src/game/index.ts';
import { winCommentary } from '../commentary.ts';

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

  const narration = useMemo(() => {
    return winCommentary(condition, winnerLabel, loserLabel, game.log.length);
  }, [condition, winnerLabel, loserLabel, game.log.length]);

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
