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
        Each of you draws 5 critters, secretly garrisons up to 4 of them across 5 arenas
        (and tucks your <span style={{color:'var(--marquee-gold)'}}>★ Ace</span> — your hidden
        champion — under one of them), then scouts, bluffs, and strikes for control of the board.
      </p>
      <h3 style={{fontSize:14, fontFamily:'var(--font-display)', margin:'14px 0 6px', color:'var(--accent)'}}>Three ways to win:</h3>
      <ul style={{margin:'0 0 12px 18px', fontSize:13, color:'var(--ink-dim)'}}>
        <li><strong style={{color:'var(--ink)'}}>🏴 Glory</strong> — hold 3 of 5 arenas at end of turn.</li>
        <li><strong style={{color:'var(--ink)'}}>⏳ Endurance</strong> — opponent runs out of critters (hand + deck + board).</li>
        <li><strong style={{color:'var(--ink)'}}>🦂 Assassination</strong> — find and burn the opponent's Ace. The hidden prize kill.</li>
      </ul>
      <h3 style={{fontSize:14, fontFamily:'var(--font-display)', margin:'14px 0 6px', color:'var(--accent)'}}>Why an Ace?</h3>
      <p style={{fontSize:12, color:'var(--ink-dim)', margin:'0 0 10px'}}>
        Your Ace defends with +1 die and survives ties at game-end. Hunting the OPPONENT'S Ace
        is the third win condition — they have to place one too, so the bluff goes both ways.
      </p>
      <h3 style={{fontSize:14, fontFamily:'var(--font-display)', margin:'14px 0 6px', color:'var(--accent)'}}>What's a bluff for?</h3>
      <p style={{fontSize:12, color:'var(--ink-dim)', margin:'0 0 10px'}}>
        When you garrison a critter, you can publicly DECLARE it as anything — truth or lie.
        Lies bait the opponent into wasting strikes on the wrong target — or into a free, public
        <strong> Call</strong> that <em>burns the garrison if they're right</em>. High-risk, high-reward.
      </p>
      <h3 style={{fontSize:14, fontFamily:'var(--font-display)', margin:'14px 0 6px', color:'var(--accent)'}}>What's the seed?</h3>
      <p style={{fontSize:12, color:'var(--ink-dim)', margin:'0 0 14px'}}>
        It's the random-number key. <strong>Same seed = same match</strong> (same shuffle, same dice). Useful if you want a do-over with identical cards, or to send your opponent a specific scenario. Just hit <strong>Random</strong> for a fresh game.
      </p>
      <div className="v2-row" style={{marginTop:8}}>
        <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>seed</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(Number(e.target.value))}
          style={{ width: 100, padding: 8, background: '#1d1a17', color: 'var(--ink)', border: '1px solid var(--rule)', fontFamily: 'inherit' }}
        />
        <button className="ghost" onClick={() => onSeedChange(Math.floor(Math.random() * 100000))}>Random</button>
        <button onClick={onStart}>Start match</button>
      </div>
      <p style={{ marginTop: 18, fontSize: 11, color:'var(--ink-dim)' }}>
        Decks are split from the starter pool — you and your opponent get DIFFERENT critters.
        Arenas: 5 biomes picked at random. <strong>Starting hand: 5</strong>. <strong>Hand cap during play: 3</strong> —
        you draw only if your hand is below 3, so the first turn or two you usually won't draw.
      </p>
    </div>
  );
}
