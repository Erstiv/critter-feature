// Top-level for v0.2 hot-seat.
import { useEffect, useMemo, useState } from 'react';
import { mulberry32 } from '../../../src/engine/rng.ts';
import { newGame, applyAction, type Action, type GameState, type PlayerId } from '../../../src/game/index.ts';
import { mintDeckPair } from './rosterDecks.ts';
import { Setup } from './screens/Setup.tsx';
import { PassGate } from './components/PassGate.tsx';
import { GarrisonPhase } from './screens/GarrisonPhase.tsx';
import { Turn } from './screens/Turn.tsx';
import { Finale } from './screens/Finale.tsx';
import { ActionResult } from './components/ActionResult.tsx';
import { runAction, type ActionResult as AR, type Phase } from './state.ts';
import './styles.css';

export function V2App() {
  const [seed, setSeed] = useState(42);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [game, setGame] = useState<GameState | null>(null);
  const [pendingResult, setPendingResult] = useState<AR | null>(null);

  // mulberry32 seed reused for all randomness in this match.
  const rand = useMemo(() => game ? null : mulberry32(seed), [seed, game]);

  function startMatch() {
    const r = mulberry32(seed);
    // Cowork e0a4beac (overriding 41895397's reconcile): each player gets a
    // DISJOINT deck of ~13 critters dealt from the full 130-roster pool. No
    // creature name appears on both sides — "your critters vs their creatures"
    // is now literally true. Tags + abilities are heuristically derived from
    // class/archetype (see rosterDecks.ts) until generateCard lands.
    const { p1Deck, p2Deck } = mintDeckPair(r, 13);
    const fresh = newGame({ p1Deck, p2Deck, rand: r });
    setGame(fresh);
    setPhase({ kind: 'pass-to-garrison', player: 'p1' });
  }


  function dispatch(player: PlayerId, action: Action): boolean {
    if (!game) return false;
    const next = runAction(game, player, action, mulberry32(seed + game.log.length));
    if ('error' in next) {
      // Surface error via the result panel as a "bad" flavor.
      setPendingResult({ title: 'Cannot do that', body: [next.error], flavor: 'bad' });
      return false;
    }
    setGame(next.game);
    setPendingResult(next.result);
    return true;
  }

  function submitGarrisons(player: PlayerId, actions: Action[]) {
    // Setup-phase batch: dispatch all garrisons as one transaction. Engine enforces
    // "one main action per turn"; during setup we reset actionTakenThisTurn between
    // garrisons so the batch lands cleanly. EndTurn at the end flips active player.
    if (!game) return;
    let cur = game;
    let lastResult: AR | null = null;
    for (const a of actions) {
      // Reset the per-turn main-action gate so the next Garrison validates.
      cur = { ...cur, actionTakenThisTurn: false };
      const r = runAction(cur, player, a, mulberry32(seed + cur.log.length));
      if ('error' in r) {
        setPendingResult({ title: 'Garrison failed', body: [r.error], flavor: 'bad' });
        return;
      }
      cur = r.game;
      lastResult = r.result;
    }
    // EndTurn to flip active player.
    const r = runAction(cur, player, { kind: 'EndTurn' }, mulberry32(seed + cur.log.length));
    if (!('error' in r)) {
      cur = r.game;
    }
    setGame(cur);
    setPendingResult(lastResult);
    // Advance phase.
    if (player === 'p1') {
      setPhase({ kind: 'pass-to-garrison', player: 'p2' });
    } else {
      // Both placed → pass to whichever is active for first turn.
      setPhase({ kind: 'pass-to-turn', player: cur.activePlayer });
    }
  }

  // Check win whenever game state updates. In useEffect (not render-time side
  // effect) per React rules, so the assassination phase-flip is deterministic.
  // (Cowork 01dc9dec Q3: instrument the assassination path.)
  useEffect(() => {
    if (!game) return;
    if (game.winner && phase.kind !== 'win') {
      console.log(`[critter-feature] Win detected: ${game.winner} by ${game.winCondition}. Flipping phase to win.`);
      setPhase({ kind: 'win', winner: game.winner, condition: game.winCondition ?? 'glory' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner, game?.winCondition]);

  // ─── Render ───
  if (phase.kind === 'setup' || !game) {
    return (
      <>
        <Marquee />
        <Setup seed={seed} onSeedChange={setSeed} onStart={startMatch} />
      </>
    );
  }

  if (phase.kind === 'pass-to-garrison') {
    return (
      <>
        <Marquee />
        <PassGate
          player={phase.player}
          subtitle={`Place your garrisons (up to 4) and tuck your Ace. Other player, look away.`}
          buttonLabel={`I am ${phase.player === 'p1' ? 'Player 1' : 'Player 2'} — start garrisoning`}
          onReady={() => setPhase({ kind: 'garrison', player: phase.player })}
        />
      </>
    );
  }

  if (phase.kind === 'garrison') {
    return (
      <>
        <Marquee />
        <GarrisonPhase
          player={phase.player}
          game={game}
          onSubmit={(actions) => submitGarrisons(phase.player, actions)}
        />
      </>
    );
  }

  if (phase.kind === 'pass-to-turn') {
    return (
      <>
        <Marquee />
        <PassGate
          player={phase.player}
          subtitle={`Your turn. Pick up the device.`}
          buttonLabel={`I am ${phase.player === 'p1' ? 'Player 1' : 'Player 2'} — see my hand`}
          onReady={() => setPhase({ kind: 'turn', player: phase.player })}
        />
      </>
    );
  }

  if (phase.kind === 'turn') {
    return (
      <>
        <Marquee />
        <Turn
          player={phase.player}
          game={game}
          onAction={(a) => {
            const ok = dispatch(phase.player, a);
            if (ok && a.kind === 'EndTurn') {
              // After EndTurn, hand the device over.
              const next: PlayerId = phase.player === 'p1' ? 'p2' : 'p1';
              setPhase({ kind: 'pass-to-turn', player: next });
            }
          }}
        />
        {pendingResult && (
          <ActionResult result={pendingResult} onDismiss={() => setPendingResult(null)} />
        )}
      </>
    );
  }

  if (phase.kind === 'win') {
    return (
      <Finale
        game={game}
        winner={phase.winner}
        condition={phase.condition}
        onRematch={() => { setGame(null); setPendingResult(null); setPhase({ kind: 'setup' }); setSeed((s) => s + 1); }}
      />
    );
  }

  return null;
}

function Marquee() {
  return (
    <header className="marquee">
      <p className="marquee-eyebrow">
        <span><span className="star">★</span> Tonight's Main <span className="star">★</span></span>
      </p>
      <h1 className="marquee-title">Critter Feature</h1>
      <p className="marquee-bill">
        Hide the Tardigrade · 2-player hot-seat
      </p>
      <p className="marquee-foot">PASS-AND-PLAY · BEST OF FIVE ARENAS · v0.3</p>
    </header>
  );
}
