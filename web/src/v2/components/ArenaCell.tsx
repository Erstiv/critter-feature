import type { PlayerId } from '../../../../src/game/index.ts';
import type { Garrison, GarrisonView } from '../../../../src/game/index.ts';
import type { Biome } from '../../../../src/types.ts';
import { InfoButton } from './InfoButton.tsx';
import { StatTooltip } from './StatTooltip.tsx';

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
    <StatTooltip name={g.card.creature.name} mode="mine" card={g.card} woundOffset={g.woundOffset}>
      <div className={cls}>
        <span className="v2-garrison-label">YOU</span>
        <div className="v2-garrison-name">
          {g.card.creature.name}
          <InfoButton name={g.card.creature.name} />
          {g.isAce && <span style={{ color: 'var(--marquee-gold)', marginLeft: 4 }}>★</span>}
        </div>
        <div className="v2-garrison-meta">
          M{g.card.might} · S{Math.max(0, g.card.stamina - g.woundOffset)}
          {g.dugIn && <span className="badge" style={{ marginLeft: 4 }}>⛺ Dug-In</span>}
        </div>
        {g.declaration && <div style={{ fontSize: 10, color: 'var(--ink-dim)', marginTop: 2 }}>you declared: "{g.declaration}"</div>}
      </div>
    </StatTooltip>
  );
}

function OppGarrison({ g }: { g: GarrisonView }) {
  if (!g.hidden) {
    return (
      <StatTooltip name={g.cardName} mode="opp-revealed" card={g.card}>
        <div className="v2-garrison opp-revealed">
          <span className="v2-garrison-label">OPP</span>
          <div className="v2-garrison-name">{g.cardName}<InfoButton name={g.cardName} /></div>
          <div className="v2-garrison-meta">M{g.card.might} · S{g.card.stamina}</div>
        </div>
      </StatTooltip>
    );
  }
  const peek = g.deepScoutedName;
  const tooltipProps = {
    name: peek ?? '???',
    mode: 'opp-hidden' as const,
    sniffedTags: g.sniffedTags,
    deepScoutedCard: g.deepScoutedCard,
    declared: g.declared,
  };
  return (
    <StatTooltip {...tooltipProps}>
      <div className="v2-garrison opp-hidden">
        <span className="v2-garrison-label">OPP</span>
        <div className="v2-garrison-name">{peek ? `${peek} (face-down)` : '??? face-down'}{peek && <InfoButton name={peek} />}</div>
        {peek && g.deepScoutedCard && (
          <div className="v2-garrison-meta" style={{ color: 'var(--accent)' }}>
            M{g.deepScoutedCard.might} · S{g.deepScoutedCard.stamina} <span style={{fontStyle:'italic'}}>(you scouted it)</span>
          </div>
        )}
        {!peek && g.declared && <div style={{ fontSize: 10 }}>they claim: "{g.declared}"</div>}
        {!peek && g.sniffedTags && g.sniffedTags.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--accent)' }}>sniffed: [{g.sniffedTags.join(', ')}]</div>
        )}
      </div>
    </StatTooltip>
  );
}
