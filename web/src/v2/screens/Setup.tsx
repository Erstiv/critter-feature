type Props = {
  seed: number;
  onSeedChange: (n: number) => void;
  onStart: () => void;
};

export function Setup({ seed, onSeedChange, onStart }: Props) {
  return (
    <div className="v2-setup-panel">
      <h2>Hide the Tardigrade — 2-player hot-seat</h2>
      <p>
        You'll each draft 5 critters from the starter roster, secretly garrison
        up to 4 of them across 5 arenas (and tuck your Ace under one), then
        scout, bluff, and strike for control. Win three ways: hold 3 of 5
        arenas (Glory), starve the opponent's hand (Endurance), or assassinate
        their Ace (the prize kill).
      </p>
      <div className="v2-row">
        <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>seed</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(Number(e.target.value))}
          style={{ width: 100, padding: 8, background: '#1d1a17', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit' }}
        />
        <button onClick={onStart}>Start match</button>
      </div>
      <p style={{ marginTop: 18, fontSize: 11 }}>
        Both decks: starter 9 (random 5 drawn). Arenas: 5 biomes picked at random.
      </p>
    </div>
  );
}
