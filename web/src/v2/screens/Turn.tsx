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
        <span className="you">{player === 'p1' ? 'Player 1' : 'Player 2'}'s turn — your critters are <strong style={{color:'var(--good)'}}>GREEN</strong>, their creatures are <strong style={{color:'var(--danger)'}}>RED</strong></span>
        <span className="opp">
          Your scouts: {view.myScoutTokens} · Their scouts: {view.opponent.scoutTokens} · Their hand: {view.opponent.handSize} · Their deck: {view.opponent.deckSize}
        </span>
      </div>
      {view.myGarrisons.length > 0 && (
        <div style={{ background: '#1a2018', border: '1px solid var(--good)', borderLeft: '4px solid var(--good)', padding: '8px 12px', borderRadius: 3, marginBottom: 12, fontSize: 12 }}>
          <strong style={{ color: 'var(--good)' }}>Your critters on the board:</strong>{' '}
          {view.myGarrisons.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ' · '}
              <strong style={{color:'var(--ink)'}}>{g.card.creature.name}</strong> at {view.arenas[g.arena]!.biome}
              {g.isAce && <span title="Your Ace" style={{color:'var(--marquee-gold)'}}> ★</span>}
            </span>
          ))}
        </div>
      )}

      <div className="v2-section-title">Arenas — tonight's bill</div>
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

      <div className="v2-section-title">Your Critters (in hand)</div>
      <HandStrip hand={view.myHand} />

      <div className="v2-section">
        {!game.actionTakenThisTurn ? (
          <>
            <div className="v2-section-title">Pick your move (one per turn)</div>
            <div className="v2-actions">
              <button
                onClick={() => setModal({ kind: 'garrison' })}
                disabled={view.myHand.length === 0}
                title={
                  view.myHand.length === 0 ? 'No critters in hand'
                  : 'Place a critter face-down in an empty arena. Optionally declare its name (truth OR bluff).'
                }
              >Hide</button>
              <button
                onClick={() => setModal({ kind: 'scout' })}
                title="Spend scout tokens to learn what a creature is. Sniff (1 tag), Probe (yes/no), or Deep Scout (full card)."
              >Scout</button>
              <button
                onClick={() => setModal({ kind: 'strike' })}
                title="Attack any arena from your hand, or from one of your hidden critters. Loser burns; winner takes the banner."
              >Attack</button>
              <button
                onClick={() => setModal({ kind: 'redeploy' })}
                disabled={view.myGarrisons.length === 0}
                title={
                  view.myGarrisons.length === 0 ? 'No critters on the board to move'
                  : 'Move one of your critters to an empty arena. They go back into the dark (re-hidden); the Dug-In bonus is lost.'
                }
              >Move</button>
              <button
                onClick={() => setModal({ kind: 'call' })}
                className="ghost"
                title="Free, public, risky. If they lied → that creature burns. If truth → you lose a scout token + reveal one of yours."
              >Call a bluff (free)</button>
            </div>
          </>
        ) : (
          <>
            <div className="v2-section-title" style={{ color: 'var(--good)' }}>Action taken. Pass the device when ready.</div>
            <div className="v2-actions">
              <button
                onClick={() => setModal({ kind: 'call' })}
                className="ghost"
                title="Free, public. If they lied → burn that creature. If truth → you pay a token + reveal one of yours."
              >Call a bluff (free)</button>
              <button
                onClick={() => onAction({ kind: 'EndTurn' })}
                title="Draw 1 (up to hand cap 3), pass the device to your opponent."
              >End turn ▸</button>
            </div>
          </>
        )}
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
        <h2>Hide a critter</h2>
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
          <label>Which arena's creature:</label>
          {oppGarrisons.map((g) => (
            <button key={g.arena} className={arena === g.arena ? '' : 'ghost'} onClick={() => setArena(g.arena)}>{view.arenas[g.arena]!.biome}</button>
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
        <h2>Attack</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          Send a critter at an arena. From hand: card leaves your hand and (if it wins) garrisons the arena. From the board: your critter sallies out and (if it wins) holds the new ground.
          Loser BURNS. Winner takes the banner.
        </p>

        <div className="v2-section-title">Source: from hand</div>
        <HandStrip hand={view.myHand} selectedName={source?.kind === 'hand' ? source.cardName : undefined} onSelect={(n) => setSource({ kind: 'hand', cardName: n })} />

        {view.myGarrisons.length > 0 && (
          <>
            <div className="v2-section-title" style={{ marginTop: 12 }}>Or: send one of your critters from the board (leaves its current arena!)</div>
            <div className="v2-row">
              {view.myGarrisons.map((g) => (
                <button
                  key={g.id}
                  className={source?.kind === 'arena' && source.index === g.arena ? '' : 'ghost'}
                  onClick={() => setSource({ kind: 'arena', index: g.arena })}
                  title={`Send ${g.card.creature.name} away from ${view.arenas[g.arena]!.biome}. If it wins, it stays in the new arena (and the original goes empty).`}
                >
                  {g.card.creature.name} <span style={{ color: 'var(--ink-dim)', fontSize: 10 }}>(at {view.arenas[g.arena]!.biome})</span>
                </button>
              ))}
            </div>
            {source?.kind === 'arena' && (
              <p style={{ fontSize: 11, color: 'var(--exposed)', marginTop: 6 }}>
                ⚠ {view.myGarrisons.find(g => g.arena === source.index)?.card.creature.name} will LEAVE {view.arenas[source.index]!.biome}. If they lose, they burn. If they win, the original arena goes empty (and your banner there flips to neutral).
              </p>
            )}
          </>
        )}

        <div className="v2-section-title" style={{ marginTop: 12 }}>Target arena (pick where to attack)</div>
        <div className="v2-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          {view.arenas.map((a) => {
            // Cowork d4a5dc89: adjacency dropped. Only restriction: can't attack the arena you're in.
            const eligible = source?.kind === 'hand' || (source?.kind === 'arena' && source.index !== a.index);
            const opp = view.opponent.garrisons.find((g) => g.arena === a.index);
            const oppLabel = !opp
              ? <span style={{color:'var(--ink-dim)'}}>empty — free banner if you win</span>
              : (opp.hidden
                ? <span style={{color:'var(--danger)'}}>??? face-down{(opp as { declared?: string }).declared ? ` (claims "${(opp as { declared?: string }).declared}")` : ''}</span>
                : <span style={{color:'var(--danger)'}}>{(opp as { cardName: string }).cardName} (revealed)</span>);
            const myG = view.myGarrisons.find((g) => g.arena === a.index);
            return (
              <button
                key={a.index}
                className={targetArena === a.index ? '' : 'ghost'}
                onClick={() => eligible && setTargetArena(a.index)}
                disabled={!eligible}
                title={eligible ? `Attack at ${a.biome}` : (myG ? 'Your critter is already here' : 'Already in this arena')}
                style={{ textAlign: 'left', padding: '8px 12px' }}
              >
                <span style={{fontFamily:'var(--font-marquee)', fontWeight:700}}>{a.biome}</span>
                <span style={{ marginLeft: 8, fontSize: 11 }}> — they have: {oppLabel}{myG ? <span style={{color:'var(--good)', marginLeft:8}}> · you: {myG.card.creature.name}</span> : null}</span>
              </button>
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
          >Attack</button>
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
        <h2>Move a critter (re-hides into the dark, loses Dug-In)</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>They slip into the night and reappear face-down somewhere else. Useful for repositioning a revealed critter — or your Ace.</p>
        <div className="v2-row">
          <label>Move which critter:</label>
          {view.myGarrisons.map((g) => (
            <button key={g.id} className={from === g.arena ? '' : 'ghost'} onClick={() => setFrom(g.arena)} title={`Currently at ${g.card.creature.name}'s arena`}>{g.card.creature.name}</button>
          ))}
        </div>
        <div className="v2-row" style={{ marginTop: 8 }}>
          <label>To where:</label>
          {view.arenas.map((a) => {
            const eligible = from !== undefined && from !== a.index && !occupied.has(a.index);
            return (
              <button key={a.index} className={to === a.index ? '' : 'ghost'} onClick={() => eligible && setTo(a.index)} disabled={!eligible} title={eligible ? '' : (occupied.has(a.index) ? 'You already have a critter here' : 'Already there')}>
                {a.biome}
              </button>
            );
          })}
        </div>
        <div className="v2-actions">
          <button onClick={() => from !== undefined && to !== undefined && onConfirm({ kind: 'Redeploy', fromArena: from, toArena: to })} disabled={from === undefined || to === undefined}>Move</button>
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
