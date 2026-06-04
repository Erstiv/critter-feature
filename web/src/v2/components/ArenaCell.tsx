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

export function ArenaCell({ index, biome, banner, myGarrison, oppGarrison, selectable, selected, onClick }: Props) {
  const className = ['v2-arena', selectable && 'selectable', selected && 'selected'].filter(Boolean).join(' ');
  return (
    <div className={className} onClick={onClick}>
      <div className="v2-arena-header">
        <span className="v2-arena-num">A{index + 1}</span>
        <span className="v2-arena-biome">{biome}</span>
      </div>
      <div className="v2-arena-banner">
        {banner === null ? <span style={{ color: 'var(--ink-dim)' }}>·</span> : <span title={`${banner} banner`}>🏴</span>}
        {banner && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>{banner}</span>}
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

function MyGarrison({ g }: { g: Garrison }) {
  const cls = ['v2-garrison', 'mine', g.isAce && 'ace'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="v2-garrison-name">
        {g.card.creature.name}
        {g.isAce && <span style={{ color: 'var(--marquee-gold)', marginLeft: 4 }}>★</span>}
      </div>
      <div className="v2-garrison-meta">
        M{g.card.might} · S{Math.max(0, g.card.stamina - g.woundOffset)}
        {g.dugIn && <span className="badge" style={{ marginLeft: 4 }}>⛺ Dug-In</span>}
      </div>
      {g.declaration && <div style={{ fontSize: 10, color: 'var(--ink-dim)', marginTop: 2 }}>declared: "{g.declaration}"</div>}
    </div>
  );
}

function OppGarrison({ g }: { g: GarrisonView }) {
  if (!g.hidden) {
    return (
      <div className="v2-garrison opp-revealed">
        <div className="v2-garrison-name">{g.cardName}</div>
        <div className="v2-garrison-meta">M{g.card.might} · S{g.card.stamina}</div>
      </div>
    );
  }
  return (
    <div className="v2-garrison opp-hidden">
      <div className="v2-garrison-name">??? face-down</div>
      {g.declared && <div style={{ fontSize: 10 }}>claims: "{g.declared}"</div>}
      {g.sniffedTags && g.sniffedTags.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--accent)' }}>sniffed: [{g.sniffedTags.join(', ')}]</div>
      )}
    </div>
  );
}
