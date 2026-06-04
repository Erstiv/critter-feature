// Setup phase per §3: each player places up to 4 face-down garrisons and the Ace.
// Pass-and-play via the PassGate on either side of each player's session.

import { useState } from 'react';
import type { GameState, PlayerId, Action } from '../../../../src/game/index.ts';
import { playerView } from '../../../../src/game/index.ts';
import { deriveCard } from '../../../../src/engine/deriveCard.ts';
import { ArenaCell } from '../components/ArenaCell.tsx';
import { HandStrip } from '../components/HandStrip.tsx';

type Props = {
  player: PlayerId;
  game: GameState;
  onSubmit: (actions: Action[]) => void;
};

export function GarrisonPhase({ player, game, onSubmit }: Props) {
  const view = playerView(game, player);
  // Local pending garrison plan; we submit as a batch at end.
  const [placements, setPlacements] = useState<{ cardName: string; arena: number; declaration?: string; isAce: boolean }[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | undefined>(undefined);
  const [pendingAce, setPendingAce] = useState(false);
  const [decl, setDecl] = useState('');

  const placedCardNames = new Set(placements.map((p) => p.cardName));
  const remainingHand = view.myHand.filter((c) => !placedCardNames.has(c.name));
  const placedArenas = new Set(placements.map((p) => p.arena));
  const cap = 4;
  const placementsRemaining = cap - placements.length;
  const aceAssigned = placements.some((p) => p.isAce);

  function placeAt(arenaIdx: number) {
    if (!selectedCard) return;
    if (placedArenas.has(arenaIdx)) return;
    if (placements.length >= cap) return;
    const isAce = pendingAce && !aceAssigned;
    const entry: { cardName: string; arena: number; declaration?: string; isAce: boolean } = {
      cardName: selectedCard,
      arena: arenaIdx,
      isAce,
    };
    if (decl.trim()) entry.declaration = decl.trim();
    setPlacements([...placements, entry]);
    setSelectedCard(undefined);
    setDecl('');
    setPendingAce(false);
  }

  function clearLast() {
    setPlacements(placements.slice(0, -1));
  }

  function removeAt(arenaIdx: number) {
    setPlacements(placements.filter((p) => p.arena !== arenaIdx));
  }

  function submit() {
    if (!aceAssigned) return;  // require Ace
    const actions: Action[] = [];
    for (const p of placements) {
      const a: Action = { kind: 'Garrison', cardName: p.cardName, arena: p.arena, placeAce: p.isAce };
      if (p.declaration !== undefined) (a as Extract<Action, { kind: 'Garrison' }>).declaration = p.declaration;
      actions.push(a);
    }
    // After all garrisons, EndTurn — but EndTurn requires actionTakenThisTurn=true,
    // which the last garrison sets. So just enumerating placements + an EndTurn works.
    // We'll let the parent dispatch each + EndTurn at the end.
    onSubmit(actions);
  }

  // Build a view-state that includes our pending placements visually.
  const pseudoView = view; // re-use; we'll patch garrison list visually
  const visualGarrisons = placements.map((p, i) => {
    const card = view.myHand.find((c) => c.name === p.cardName)!;
    return { ...p, index: i, card };
  });

  return (
    <div className="v2-app">
      <div className="v2-status">
        <span><span className="you">{player === 'p1' ? 'Player 1' : 'Player 2'} — Garrison phase</span></span>
        <span className="opp">
          Placements: {placements.length}/{cap} {aceAssigned ? '· ★ Ace placed' : '· ★ Ace NOT placed'} ·
          Hand: {remainingHand.length}
        </span>
      </div>

      <div className="v2-section-title">Arenas — pick a critter below, click an empty arena to place. Click a placed critter to pick it back up.</div>
      <div className="v2-arena-row">
        {pseudoView.arenas.map((a) => {
          const pending = visualGarrisons.find((p) => p.arena === a.index);
          return (
            <ArenaCell
              key={a.index}
              index={a.index}
              biome={a.biome}
              banner={a.banner}
              myGarrison={pending ? {
                id: `pending-${pending.index}`,
                owner: player,
                card: deriveCard(pending.card),
                arena: a.index,
                hidden: true,
                dugIn: false,
                isAce: pending.isAce,
                woundOffset: 0,
                ...(pending.declaration ? { declaration: pending.declaration } : {}),
              } : null}
              oppGarrison={null}
              selectable={(!!selectedCard && !pending) || !!pending}
              selected={false}
              onClick={() => pending ? removeAt(a.index) : placeAt(a.index)}
            />
          );
        })}
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Your hand — pick a critter to place</div>
        <HandStrip hand={remainingHand} selectedName={selectedCard} onSelect={(n) => setSelectedCard(n)} />

        <div className="v2-row" style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>declare (optional bluff):</label>
          <input
            type="text"
            value={decl}
            onChange={(e) => setDecl(e.target.value)}
            placeholder="e.g. Tardigrade"
            style={{ padding: 6, background: '#1d1a17', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit' }}
          />
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={pendingAce}
              onChange={(e) => setPendingAce(e.target.checked)}
              disabled={aceAssigned}
            /> Tuck Ace here
          </label>
          <button className="ghost" onClick={clearLast} disabled={placements.length === 0}>Undo last</button>
        </div>
      </div>

      <div className="v2-row" style={{ marginTop: 24 }}>
        <button
          onClick={submit}
          disabled={placementsRemaining === cap /* no placements at all */ || !aceAssigned}
          title={!aceAssigned ? 'You must tuck the Ace under one garrison' : ''}
        >
          Lock in {placements.length} garrison{placements.length === 1 ? '' : 's'} → pass device
        </button>
        {!aceAssigned && <span style={{ color: 'var(--danger)', fontSize: 12 }}>Ace required</span>}
      </div>
    </div>
  );
}
