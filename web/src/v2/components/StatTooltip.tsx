// Hover/tap stat tooltip — at-a-glance combat info for any critter.
// Complements InfoButton (flavor/funFacts). Cowork ebed31fd.
//
// Modes:
//   - 'mine'         → full stats (Might, current/max Stamina, tags, ability)
//   - 'opp-revealed' → full stats (we know what it is)
//   - 'opp-hidden'   → "??? — scout to reveal" + any partial reveals (sniffed
//                       tags, Deep Scout peek) the asker has earned

import { useState, useRef, useEffect, type ReactNode } from 'react';
import type { Creature, Card, Tag } from '../../../../src/types.ts';
import { deriveCard } from '../../../../src/engine/deriveCard.ts';

type Props = {
  // Identification — name is always required.
  name: string;
  // Mode determines how much to reveal.
  mode: 'mine' | 'opp-revealed' | 'opp-hidden';
  // Stats — provide for 'mine' and 'opp-revealed'. For 'opp-hidden', pass
  // whatever the player has scouted: sniffed tags AND/OR a Deep Scout card.
  card?: Card | undefined;
  woundOffset?: number;
  // For opp-hidden: what the asker has learned via Scout.
  sniffedTags?: readonly Tag[] | undefined;
  deepScoutedCard?: Card | undefined;
  // Optional declaration (bluff or truth) on the opp's face-down garrison.
  declared?: string | undefined;
  children: ReactNode;
};

export function StatTooltip(props: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  function show(e: React.MouseEvent | React.FocusEvent | React.TouchEvent) {
    const target = wrapRef.current;
    if (!target) return;
    const r = target.getBoundingClientRect();
    const e2 = (e as React.MouseEvent);
    const x = e2.clientX ?? r.left + r.width / 2;
    const y = r.top - 8;
    setPos({ x, y });
    setOpen(true);
  }
  function hide() { setOpen(false); }

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={(e) => { show(e); setTimeout(hide, 4000); }}
      style={{ position: 'relative' }}
    >
      {props.children}
      {open && (
        <div
          className="v2-stat-tip"
          style={{ position: 'fixed', left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
        >
          {renderBody(props)}
        </div>
      )}
    </span>
  );
}

function renderBody(p: Props) {
  if (p.mode === 'opp-hidden') {
    const peek = p.deepScoutedCard;
    return (
      <>
        <div className="v2-stat-tip-name">{peek ? `${p.name} (face-down)` : '??? face-down'}</div>
        {!peek && (
          <div className="v2-stat-tip-meta" style={{ fontStyle: 'italic' }}>
            Scout this creature to reveal its stats.
          </div>
        )}
        {p.declared && (
          <div className="v2-stat-tip-row"><span className="v2-stat-tip-label">claims:</span> "{p.declared}"</div>
        )}
        {p.sniffedTags && p.sniffedTags.length > 0 && (
          <div className="v2-stat-tip-row"><span className="v2-stat-tip-label">sniffed:</span> [{p.sniffedTags.join(', ')}]</div>
        )}
        {peek && (
          <>
            <div className="v2-stat-tip-stats">
              Might {peek.might} · Stamina {peek.stamina}
            </div>
            <div className="v2-stat-tip-row">
              <span className="v2-stat-tip-label">tags:</span> [{peek.creature.tags.join(', ') || 'none'}]
            </div>
            <div className="v2-stat-tip-ability">
              <span className="v2-stat-tip-ability-name">{peek.creature.ability.name}</span>
              <span className="v2-stat-tip-ability-meta"> ({peek.creature.ability.trigger}{peek.creature.ability.cost ? `, pay ${peek.creature.ability.cost}` : ''})</span>
              {peek.creature.flavor && <div className="v2-stat-tip-flavor">{peek.creature.flavor}</div>}
            </div>
            <div className="v2-stat-tip-meta" style={{ marginTop: 6, color: 'var(--accent)', fontSize: 10 }}>
              You Deep Scouted this — private knowledge.
            </div>
          </>
        )}
      </>
    );
  }

  // mine OR opp-revealed: full stats.
  if (!p.card) return null;
  const current = Math.max(0, p.card.stamina - (p.woundOffset ?? 0));
  const max = p.card.stamina;
  const tags = p.card.creature.tags;
  const ab = p.card.creature.ability;
  return (
    <>
      <div className="v2-stat-tip-name">{p.name}</div>
      <div className="v2-stat-tip-stats">
        Might {p.card.might} · Stamina {current}/{max}
        {current < max && <span style={{ color: 'var(--exposed)', marginLeft: 4 }}>(wounded)</span>}
      </div>
      <div className="v2-stat-tip-row">
        <span className="v2-stat-tip-label">tags:</span> [{tags.join(', ') || 'none'}]
      </div>
      {p.card.homeBiomes.length > 0 && (
        <div className="v2-stat-tip-row">
          <span className="v2-stat-tip-label">home:</span> {p.card.homeBiomes.join(', ')}
        </div>
      )}
      {p.card.exposedBiomes.length > 0 && (
        <div className="v2-stat-tip-row">
          <span className="v2-stat-tip-label">exposed:</span> <span style={{color:'var(--exposed)'}}>{p.card.exposedBiomes.join(', ')}</span>
        </div>
      )}
      <div className="v2-stat-tip-ability">
        <span className="v2-stat-tip-ability-name">{ab.name}</span>
        <span className="v2-stat-tip-ability-meta"> ({ab.trigger}{ab.cost ? `, pay ${ab.cost}` : ''}{ab.oncePerBout ? ', 1×/bout' : ''})</span>
        {p.card.creature.flavor && <div className="v2-stat-tip-flavor">{p.card.creature.flavor}</div>}
        {ab.nullVs && ab.nullVs.length > 0 && (
          <div className="v2-stat-tip-row" style={{ marginTop: 4 }}>
            <span className="v2-stat-tip-label" style={{ color: 'var(--exposed)' }}>null vs:</span> [{ab.nullVs.join(', ')}]
          </div>
        )}
      </div>
    </>
  );
}

// Helper for Hand cards (raw Creature, no garrison): build a transient Card.
export function derivedFor(c: Creature): Card {
  return deriveCard(c);
}
