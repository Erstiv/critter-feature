import { useMemo, useState } from 'react';
import { STARTER_8_PLUS } from '../../src/data/starter8.ts';
import { deriveCard } from '../../src/engine/deriveCard.ts';
import { resolveBout } from '../../src/engine/resolveBout.ts';
import { mulberry32 } from '../../src/engine/rng.ts';
import { BIOMES, type Biome } from '../../src/types.ts';
import { CardView } from './components/CardView.tsx';
import { BiomeStrip } from './components/BiomeStrip.tsx';
import { BoutLog } from './components/BoutLog.tsx';

const CREATURE_NAMES = STARTER_8_PLUS.map((c) => c.name);

export function App() {
  const [aName, setAName] = useState('Tardigrade');
  const [bName, setBName] = useState('Peregrine Falcon');
  const [picks, setPicks] = useState<Biome[]>(['Ice/Arctic', 'Sky', 'Plains']);
  const [seed, setSeed] = useState(42);
  const [resultKey, setResultKey] = useState(0);

  const aCreature = STARTER_8_PLUS.find((c) => c.name === aName)!;
  const bCreature = STARTER_8_PLUS.find((c) => c.name === bName)!;

  const aCard = useMemo(() => deriveCard(aCreature), [aCreature]);
  const bCard = useMemo(() => deriveCard(bCreature), [bCreature]);

  const result = useMemo(() => {
    return resolveBout({
      a: aCard,
      b: bCard,
      terrainPicks: picks,
      firstChallenger: 'a',
      rand: mulberry32(seed),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aCard, bCard, picks, seed, resultKey]);

  function setPick(i: number, b: Biome) {
    const next = [...picks];
    next[i] = b;
    setPicks(next);
  }

  return (
    <div className="app">
      <header className="marquee">
        <p className="marquee-eyebrow">
          <span><span className="star">★</span> Tonight's Main <span className="star">★</span></span>
        </p>
        <h1 className="marquee-title">Critter Feature</h1>
        <p className="marquee-bill">
          <span className="name">{aCreature.name}</span>
          <span className="vs">vs</span>
          <span className="name">{bCreature.name}</span>
        </p>
        <p className="marquee-foot">Tonight's Bill · One Bout · Best of Three Legs</p>
      </header>

      <div className="match">
        <div>
          <select value={aName} onChange={(e) => setAName(e.target.value)} style={{ marginBottom: 10, padding: 6, fontFamily: 'inherit', background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--rule)' }}>
            {CREATURE_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <CardView card={aCard} finalStamina={result.aFinalStamina} winner={result.winner === aCreature.name} />
        </div>
        <div>
          <select value={bName} onChange={(e) => setBName(e.target.value)} style={{ marginBottom: 10, padding: 6, fontFamily: 'inherit', background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--rule)' }}>
            {CREATURE_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <CardView card={bCard} finalStamina={result.bFinalStamina} winner={result.winner === bCreature.name} />
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Terrain picks · Leg 1 (A) / Leg 2 (B) / Leg 3 (neutral)</h2>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--ink-dim)', fontSize: 12, marginRight: 8 }}>Leg {i + 1}:</span>
            <BiomeStrip selected={picks[i]} onSelect={(b) => setPick(i, b)} biomes={BIOMES} />
          </div>
        ))}
      </div>

      <div className="controls">
        <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>seed</label>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 80, padding: 6, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit' }} />
        <button onClick={() => setResultKey((k) => k + 1)}>Re-roll bout</button>
        <button className="ghost" onClick={() => { setSeed(Math.floor(Math.random() * 100000)); setResultKey((k) => k + 1); }}>
          Random seed
        </button>
      </div>

      <div className="koLine">
        <div>
          {result.winType === 'endurance' ? '⚡ Endurance KO — ' : '🏆 Glory — '}
          <span className="winner-name">{result.winner}</span> wins!
        </div>
        <span className="ko-stats">
          Final stamina · {aCreature.name} {result.aFinalStamina} · {bCreature.name} {result.bFinalStamina}
        </span>
      </div>

      <div className="section">
        <h2 className="section-title">Bout log</h2>
        <BoutLog log={result.log} />
      </div>
    </div>
  );
}
