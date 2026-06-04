// Small (i) on each critter — opens a popover with identity + funFacts.
// Content from /web/src/data/critterInfo.json (cowork 0b7c7955). Missing key →
// hide the (i) entirely. Future content batches just merge into the JSON; no
// code changes required.

import { useState } from 'react';
import infoData from '../../data/critterInfo.json' with { type: 'json' };

type InfoEntry = { identity: string; funFacts: string[] };
const INFO: Record<string, InfoEntry> = infoData as unknown as Record<string, InfoEntry>;

export function hasInfo(name: string): boolean {
  return !!INFO[name];
}

export function InfoButton({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const entry = INFO[name];
  if (!entry) return null;
  return (
    <>
      <button
        className="v2-info-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={`About ${name}`}
        aria-label={`About ${name}`}
      >
        i
      </button>
      {open && (
        <div className="v2-info-overlay" onClick={() => setOpen(false)}>
          <div className="v2-info-card" onClick={(e) => e.stopPropagation()}>
            <div className="v2-info-header">
              <h4>{name}</h4>
              <button className="v2-info-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="v2-info-identity">{entry.identity}</p>
            <ul className="v2-info-facts">
              {entry.funFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
