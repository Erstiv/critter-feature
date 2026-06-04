import type { Card } from '../../../src/types.ts';

type Props = {
  card: Card;
  finalStamina?: number;
  winner?: boolean;
};

export function CardView({ card, finalStamina, winner }: Props) {
  const c = card.creature;
  const printedStam = card.stamina;
  const ended = typeof finalStamina === 'number';
  const stamShown = ended ? finalStamina! : printedStam;
  const stamClass = ended && stamShown <= 0 ? 'danger' : ended ? 'dim' : '';

  return (
    <div className="card" style={winner ? { boxShadow: '0 0 0 1px var(--good)' } : {}}>
      <h3 className="card-name">{c.name}</h3>
      <p className="card-class">{c.class}{c.persona ? ` · ${c.persona}` : ''}</p>

      <div className="stat-row">
        <div>
          <div className="stat-label">Might</div>
          <div className="stat-value">{card.might}</div>
        </div>
        <div>
          <div className="stat-label">Stamina {ended ? '(final)' : ''}</div>
          <div className={`stat-value ${stamClass}`}>
            {stamShown} {ended && stamShown < printedStam ? <span style={{ color: 'var(--ink-dim)', fontSize: 12 }}> / {printedStam}</span> : null}
          </div>
        </div>
      </div>

      <div className="tags">
        {c.tags.map((t) => <span key={t} className="tag">{t}</span>)}
      </div>

      <div className="biomes-line">
        <div>
          <span className="home">★ Home: </span>
          {card.homeBiomes.length ? card.homeBiomes.join(', ') : <span style={{ color: 'var(--ink-dim)' }}>none</span>}
        </div>
        <div>
          <span className="exposed">✗ Exposed: </span>
          {card.exposedBiomes.length ? card.exposedBiomes.join(', ') : <span style={{ color: 'var(--ink-dim)' }}>none</span>}
        </div>
      </div>

      <div className="ability">
        <div className="ability-name">
          {c.ability.name}
          <span style={{ color: 'var(--ink-dim)', fontWeight: 'normal', fontSize: 11, marginLeft: 6 }}>
            ({c.ability.trigger}{c.ability.cost ? `, pay ${c.ability.cost}` : ''}{c.ability.oncePerBout ? ', 1×/bout' : ''})
          </span>
        </div>
        <div className="ability-text">
          {c.flavor ?? c.ability.effects.map((e) => e.verb).join(' · ')}
          {c.ability.nullVs.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--exposed)' }}>null vs:</span> [{c.ability.nullVs.join(', ')}]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
