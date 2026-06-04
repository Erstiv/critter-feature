import type { Creature } from '../../../../src/types.ts';
import { InfoButton } from './InfoButton.tsx';
import { StatTooltip, derivedFor } from './StatTooltip.tsx';

type Props = {
  hand: Creature[];
  selectedName?: string | undefined;
  onSelect?: (name: string) => void;
};

export function HandStrip({ hand, selectedName, onSelect }: Props) {
  return (
    <div className="v2-hand">
      {hand.length === 0 && <span style={{ color: 'var(--ink-dim)', fontSize: 12 }}>(empty)</span>}
      {hand.map((c, i) => {
        const cls = ['v2-hand-card', onSelect && 'selectable', selectedName === c.name && 'selected'].filter(Boolean).join(' ');
        return (
          <StatTooltip key={`${c.name}-${i}`} name={c.name} mode="mine" card={derivedFor(c)}>
            <div className={cls} onClick={onSelect ? () => onSelect(c.name) : undefined}>
              <div className="v2-hand-name">{c.name}<InfoButton name={c.name} /></div>
              <div className="v2-hand-meta">{c.class} · [{c.tags.join(', ')}]</div>
              <div className="v2-hand-meta">{c.ability.name} <span style={{ color: 'var(--accent)' }}>({c.ability.trigger})</span></div>
            </div>
          </StatTooltip>
        );
      })}
    </div>
  );
}
