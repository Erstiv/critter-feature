import type { PlayerId } from '../../../../src/game/index.ts';
import type { Garrison, GarrisonView } from '../../../../src/game/index.ts';
import type { Biome } from '../../../../src/types.ts';

type Props = {
  index: number;
  biome: Biome;
  banner: PlayerId | null;
  myGarrison: Garrison | null;
  oppGarrison: GarrisonView | null;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function ArenaCell({ index: _index, biome, banner, myGarrison, oppGarrison, selectable, selected, onClick }: Props) {
  const className = ['v2-arena', selectable && 'selectable', selected && 'selected'].filter(Boolean).join(' ');
  // Fight-card biome name (Cowork d4a5dc89 Q4): "the Open Ocean" not "A1".
  const display = biomeDisplay(biome);
  return (
    <div className={className} onClick={onClick}>
      <div className="v2-arena-header">
        <span className="v2-arena-biome">{display}</span>
      </div>
      <div className="v2-arena-banner">
        {banner === null ? <span style={{ color: 'var(--ink-dim)' }}>·</span> : <span title={`${banner === 'p1' ? 'Player 1' : 'Player 2'} controls this arena`}>🏴</span>}
        {banner && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>{banner === 'p1' ? 'P1' : 'P2'}</span>}
      </div>

      {/* My garrison */}
      <div style={{ flex: 1 }}>
        {myGarrison ? <MyGarrison g={myGarrison} /> : <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>—</span>}
      </div>

      {/* Opp garrison */}
      <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 6 }}>
        {oppGarrison ? <OppGarrison g={oppGarrison} /> : <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>—</span>}
      </div>
    </div>
  );
}

// Map biome → fight-card name. Cowork d4a5dc89 Q4.
function biomeDisplay(b: Biome): string {
  const map: Record<Biome, string> = {
    'Open Ocean': 'the Open Ocean',
    'Deep Sea': 'the Deep',
    'Ice/Arctic': 'the Ice',
    Desert: 'the Desert',
    Jungle: 'the Jungle',
    Plains: 'the Plains',
    Mountain: 'the Mountain',
    Sky: 'the Sky',
    'Wetland/Mud': 'the Wetlands',
    Night: 'the Night',
  };
  return map[b];
}

function MyGarrison({ g }: { g: Garrison }) {
  const cls = ['v2-garrison', 'mine', g.isAce && 'ace'].filter(Boolean).join(' ');
  return (
    <div className={cls} title={`Your ${g.card.creature.name}`}>
      <span className="v2-garrison-label">YOU</span>
      <div className="v2-garrison-name">
        {g.card.creature.name}
        {g.isAce && <span style={{ color: 'var(--marquee-gold)', marginLeft: 4 }} title="Your Ace champion">★</span>}
      </div>
      <div className="v2-garrison-meta">
        M{g.card.might} · S{Math.max(0, g.card.stamina - g.woundOffset)}
        {g.dugIn && <span className="badge" style={{ marginLeft: 4 }} title="Dug-In: +2 dice when defending">⛺ Dug-In</span>}
      </div>
      {g.declaration && <div style={{ fontSize: 10, color: 'var(--ink-dim)', marginTop: 2 }}>you declared: "{g.declaration}"</div>}
    </div>
  );
}

function OppGarrison({ g }: { g: GarrisonView }) {
  if (!g.hidden) {
    return (
      <div className="v2-garrison opp-revealed" title={`Opponent's ${g.cardName} — revealed`}>
        <span className="v2-garrison-label">OPP</span>
        <div className="v2-garrison-name">{g.cardName}</div>
        <div className="v2-garrison-meta">M{g.card.might} · S{g.card.stamina}</div>
      </div>
    );
  }
  return (
    <div className="v2-garrison opp-hidden" title="Opponent's face-down garrison">
      <span className="v2-garrison-label">OPP</span>
      <div className="v2-garrison-name">??? face-down</div>
      {g.declared && <div style={{ fontSize: 10 }}>they claim: "{g.declared}"</div>}
      {g.sniffedTags && g.sniffedTags.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--accent)' }}>sniffed: [{g.sniffedTags.join(', ')}]</div>
      )}
    </div>
  );
}
