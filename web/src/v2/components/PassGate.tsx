import type { PlayerId } from '../../../../src/game/index.ts';

type Props = {
  player: PlayerId;
  subtitle?: string;
  buttonLabel?: string;
  onReady: () => void;
};

export function PassGate({ player, subtitle, buttonLabel, onReady }: Props) {
  return (
    <div className="v2-gate-cover">
      <h1>Pass to {player === 'p1' ? 'Player 1' : 'Player 2'}</h1>
      <p>{subtitle ?? 'Hand the device over. The other player\'s hand is hidden.'}</p>
      <button onClick={onReady}>
        {buttonLabel ?? `I am ${player === 'p1' ? 'Player 1' : 'Player 2'} — Begin`}
      </button>
    </div>
  );
}
