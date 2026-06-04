// Active player's turn screen — board view + action menu.
import { useState } from 'react';
import type { Action, GameState, PlayerId, ScoutKind } from '../../../../src/game/index.ts';
import { playerView, effectiveScoutCost } from '../../../../src/game/index.ts';
import { ArenaCell } from '../components/ArenaCell.tsx';
import { HandStrip } from '../components/HandStrip.tsx';

type Props = {
  player: PlayerId;
  game: GameState;
  onAction: (action: Action) => void;
};

type ModalState =
  | { kind: 'none' }
  | { kind: 'garrison' }
  | { kind: 'scout' }
  | { kind: 'strike' }
  | { kind: 'redeploy' }
  | { kind: 'call' };

export function Turn({ player, game, onAction }: Props) {
  const view = playerView(game, player);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  return (
    <div className="v2-app">
      <div className="v2-status">
        <span className="you">{player === 'p1' ? 'Player 1' : 'Player 2'}'s turn</span>
        <span className="opp">
          Scout tokens: {view.myScoutTokens} {view.opponent.scoutTokens >= 0 ? `· Opp scouts: ${view.opponent.scoutTokens}` : ''}
          {' · '}Opp hand: {view.opponent.handSize} · Opp deck: {view.opponent.deckSize}
        </span>
      </div>

      <div className="v2-section-title">Arenas</div>
      <div className="v2-arena-row">
        {view.arenas.map((a) => (
          <ArenaCell
            key={a.index}
            index={a.index}
            biome={a.biome}
            banner={a.banner}
            myGarrison={view.myGarrisons.find((g) => g.arena === a.index) ?? null}
            oppGarrison={view.opponent.garrisons.find((g) => g.arena === a.index) ?? null}
          />
        ))}
      </div>

      <div className="v2-section-title">Your hand</div>
      <HandStrip hand={view.myHand} />

      <div className="v2-section">
        <div className="v2-section-title">Action — pick one</div>
        <div className="v2-actions">
          <button onClick={() => setModal({ kind: 'garrison' })} disabled={view.myHand.length === 0 || game.actionTakenThisTurn}>
            Garrison
          </button>
          <button onClick={() => setModal({ kind: 'scout' })} disabled={game.actionTakenThisTurn}>
            Scout
          </button>
          <button onClick={() => setModal({ kind: 'strike' })} disabled={game.actionTakenThisTurn}>
            Strike
          </button>
          <button onClick={() => setModal({ kind: 'redeploy' })} disabled={view.myGarrisons.length === 0 || game.actionTakenThisTurn}>
            Redeploy
          </button>
          <button onClick={() => setModal({ kind: 'call' })} className="ghost">
            Call a bluff (free)
          </button>
          <button onClick={() => onAction({ kind: 'EndTurn' })} disabled={!game.actionTakenThisTurn}>
            End turn
          </button>
        </div>
      </div>

      {modal.kind === 'garrison' && (
        <GarrisonModal player={player} game={game} onCancel={() => setModal({ kind: 'none' })} onConfirm={(a) => { setModal({ kind: 'none' }); onAction(a); }} />
      )}
      {modal.kind === 'scout' && (
        <ScoutModal player={player} game={game} onCancel={() => setModal({ kind: 'none' })} onConfirm={(a) => { setModal({ kind: 'none' }); onAction(a); }} />
      )}
      {modal.kind === 'strike' && (
        <StrikeModal player={player} game={game} onCancel={() => setModal({ kind: 'none' })} onConfirm={(a) => { setModal({ kind: 'none' }); onAction(a); }} />
      )}
      {modal.kind === 'redeploy' && (
        <RedeployModal player={player} game={game} onCancel={() => setModal({ kind: 'none' })} onConfirm={(a) => { setModal({ kind: 'none' }); onAction(a); }} />
      )}
      {modal.kind === 'call' && (
        <CallModal player={player} game={game} onCancel={() => setModal({ kind: 'none' })} onConfirm={(a) => { setModal({ kind: 'none' }); onAction(a); }} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Modals
// ──────────────────────────────────────────────────────────────

function GarrisonModal({ player, game, onCancel, onConfirm }: { player: PlayerId; game: GameState; onCancel: () => void; onConfirm: (a: Action) => void }) {
  const view = playerView(game, player);
  const occupied = new Set(view.myGarrisons.map((g) => g.arena));
  const empty = view.arenas.filter((a) => !occupied.has(a.index));
  const [cardName, setCardName] = useState<string | undefined>(undefined);
  const [arena, setArena] = useState<number | undefined>(undefined);
  const [decl, setDecl] = useState('');
  return (
    <div className="v2-modal-backdrop">
      <div className="v2-modal">
        <h2>Garrison a critter</h2>
        <div className="v2-section-title">Pick a card</div>
        <HandStrip hand={view.myHand} selectedName={cardName} onSelect={setCardName} />
        <div className="v2-section-title" style={{ marginTop: 12 }}>Pick an empty arena</div>
        <div className="v2-arena-row" style={{ gridTemplateColumns: `repeat(${empty.length}, 1fr)` }}>
          {empty.map((a) => (
            <ArenaCell
              key={a.index}
              index={a.index}
              biome={a.biome}
              banner={a.banner}
              myGarrison={null}
              oppGarrison={view.opponent.garrisons.find((g) => g.arena === a.index) ?? null}
              selectable
              selected={arena === a.index}
              onClick={() => setArena(a.index)}
            />
          ))}
        </div>
        <div className="v2-row" style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>declare (optional bluff):</label>
          <input
            value={decl}
            onChange={(e) => setDecl(e.target.value)}
            placeholder='e.g. "Tardigrade"'
            style={{ padding: 6, background: '#1d1a17', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit' }}
          />
        </div>
        <div className="v2-actions">
          <button
            onClick={() => {
              if (!cardName || arena === undefined) return;
              const a: Action = { kind: 'Garrison', cardName, arena };
              if (decl.trim()) (a as Extract<Action, { kind: 'Garrison' }>).declaration = decl.trim();
              onConfirm(a);
            }}
            disabled={!cardName || arena === undefined}
          >Confirm</button>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ScoutModal({ player, game, onCancel, onConfirm }: { player: PlayerId; game: GameState; onCancel: () => void; onConfirm: (a: Action) => void }) {
  const view = playerView(game, player);
  const oppGarrisons = view.opponent.garrisons;
  const [arena, setArena] = useState<number | undefined>(undefined);
  const [kind, setKind] = useState<ScoutKind>('Sniff');
  const [probeQuery, setProbeQuery] = useState('is this your Ace?');
  const targetPlayer = (player === 'p1' ? 'p2' : 'p1') as PlayerId;
  const cost = effectiveScoutCost(game, player, kind);
  return (
    <div className="v2-modal-backdrop">
      <div className="v2-modal">
        <h2>Scout</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          Targets: {oppGarrisons.length === 0 ? '(none — opponent has no garrisons)' : `${oppGarrisons.length} opponent garrison(s)`}.
        </p>
        <div className="v2-row">
          <label>Arena:</label>
          {oppGarrisons.map((g) => (
            <button key={g.arena} className={arena === g.arena ? '' : 'ghost'} onClick={() => setArena(g.arena)}>A{g.arena + 1}</button>
          ))}
        </div>
        <div className="v2-row" style={{ marginTop: 10 }}>
          <label>Kind:</label>
          <button className={kind === 'Sniff' ? '' : 'ghost'} onClick={() => setKind('Sniff')}>Sniff (1)</button>
          <button className={kind === 'Probe' ? '' : 'ghost'} onClick={() => setKind('Probe')}>Probe (1)</button>
          <button className={kind === 'DeepScout' ? '' : 'ghost'} onClick={() => setKind('DeepScout')}>Deep Scout (2)</button>
        </div>
        {kind === 'Probe' && (
          <div className="v2-row" style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12 }}>Query:</label>
            <input
              value={probeQuery}
              onChange={(e) => setProbeQuery(e.target.value)}
              style={{ padding: 6, background: '#1d1a17', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit', minWidth: 220 }}
            />
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 10 }}>
          Effective cost: {cost.cost} {cost.usedFreeSniff ? '(free Sniff!)' : ''} · You have {view.myScoutTokens} tokens.
        </p>
        <div className="v2-actions">
          <button
            onClick={() => {
              if (arena === undefined) return;
              const a: Action = { kind: 'Scout', targetPlayer, targetArena: arena, scoutKind: kind };
              if (kind === 'Probe') (a as Extract<Action, { kind: 'Scout' }>).probeQuery = probeQuery;
              onConfirm(a);
            }}
            disabled={arena === undefined}
          >Scout</button>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function StrikeModal({ player, game, onCancel, onConfirm }: { player: PlayerId; game: GameState; onCancel: () => void; onConfirm: (a: Action) => void }) {
  const view = playerView(game, player);
  const [source, setSource] = useState<{ kind: 'hand'; cardName: string } | { kind: 'arena'; index: number } | undefined>(undefined);
  const [targetArena, setTargetArena] = useState<number | undefined>(undefined);
  return (
    <div className="v2-modal-backdrop">
      <div className="v2-modal">
        <h2>Strike</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>From hand (any target) or adjacent garrison (linear, |from−to|=1).</p>

        <div className="v2-section-title">Source: hand</div>
        <HandStrip hand={view.myHand} selectedName={source?.kind === 'hand' ? source.cardName : undefined} onSelect={(n) => setSource({ kind: 'hand', cardName: n })} />

        {view.myGarrisons.length > 0 && (
          <>
            <div className="v2-section-title" style={{ marginTop: 12 }}>Or: from a garrison</div>
            <div className="v2-row">
              {view.myGarrisons.map((g) => (
                <button
                  key={g.id}
                  className={source?.kind === 'arena' && source.index === g.arena ? '' : 'ghost'}
                  onClick={() => setSource({ kind: 'arena', index: g.arena })}
                >
                  A{g.arena + 1}: {g.card.creature.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="v2-section-title" style={{ marginTop: 12 }}>Target arena</div>
        <div className="v2-row">
          {view.arenas.map((a) => {
            // Adjacency rule for garrison-source strikes.
            const eligible = source?.kind === 'hand' || (source?.kind === 'arena' && Math.abs(source.index - a.index) === 1);
            return (
              <button
                key={a.index}
                className={targetArena === a.index ? '' : 'ghost'}
                onClick={() => eligible && setTargetArena(a.index)}
                disabled={!eligible}
                title={eligible ? '' : 'Not adjacent'}
              >A{a.index + 1} {a.biome}</button>
            );
          })}
        </div>

        <div className="v2-actions">
          <button
            onClick={() => {
              if (!source || targetArena === undefined) return;
              const a: Action = source.kind === 'hand'
                ? { kind: 'Strike', sourceArena: 'hand', sourceCardName: source.cardName, targetArena }
                : { kind: 'Strike', sourceArena: source.index, targetArena };
              onConfirm(a);
            }}
            disabled={!source || targetArena === undefined}
          >Strike</button>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RedeployModal({ player, game, onCancel, onConfirm }: { player: PlayerId; game: GameState; onCancel: () => void; onConfirm: (a: Action) => void }) {
  const view = playerView(game, player);
  const [from, setFrom] = useState<number | undefined>(undefined);
  const [to, setTo] = useState<number | undefined>(undefined);
  const occupied = new Set(view.myGarrisons.map((g) => g.arena));
  return (
    <div className="v2-modal-backdrop">
      <div className="v2-modal">
        <h2>Redeploy (linear adjacent, strips Dug-In)</h2>
        <div className="v2-row">
          <label>From:</label>
          {view.myGarrisons.map((g) => (
            <button key={g.id} className={from === g.arena ? '' : 'ghost'} onClick={() => setFrom(g.arena)}>A{g.arena + 1}: {g.card.creature.name}</button>
          ))}
        </div>
        <div className="v2-row" style={{ marginTop: 8 }}>
          <label>To:</label>
          {view.arenas.map((a) => {
            const eligible = from !== undefined && !occupied.has(a.index) && Math.abs(from - a.index) === 1;
            return (
              <button key={a.index} className={to === a.index ? '' : 'ghost'} onClick={() => eligible && setTo(a.index)} disabled={!eligible}>
                A{a.index + 1}
              </button>
            );
          })}
        </div>
        <div className="v2-actions">
          <button onClick={() => from !== undefined && to !== undefined && onConfirm({ kind: 'Redeploy', fromArena: from, toArena: to })} disabled={from === undefined || to === undefined}>Redeploy</button>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CallModal({ player, game, onCancel, onConfirm }: { player: PlayerId; game: GameState; onCancel: () => void; onConfirm: (a: Action) => void }) {
  const view = playerView(game, player);
  const declared = view.opponent.garrisons.filter((g) => g.hidden && (g as { declared?: string }).declared);
  const [arena, setArena] = useState<number | undefined>(undefined);
  const targetPlayer = (player === 'p1' ? 'p2' : 'p1') as PlayerId;
  return (
    <div className="v2-modal-backdrop">
      <div className="v2-modal">
        <h2>Call a bluff</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          If they lied → that garrison burns and you take the arena.<br />
          If they told the truth → −1 scout token + you reveal one of yours.
        </p>
        {declared.length === 0 ? (
          <p>No declared garrisons to call.</p>
        ) : (
          <div className="v2-row">
            {declared.map((g) => (
              <button key={g.arena} className={arena === g.arena ? '' : 'ghost'} onClick={() => setArena(g.arena)}>
                A{g.arena + 1}: claims "{(g as { declared?: string }).declared}"
              </button>
            ))}
          </div>
        )}
        <div className="v2-actions">
          <button onClick={() => arena !== undefined && onConfirm({ kind: 'Call', targetPlayer, targetArena: arena })} disabled={arena === undefined}>Call</button>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
