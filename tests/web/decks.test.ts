// Verifies cowork e0a4beac: dealt deck pair is DISJOINT (no shared creature name).
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/rng.ts';
import { mintDeckPair, decksDisjoint } from '../../web/src/v2/rosterDecks.ts';

describe('disjoint deck pair from 130-roster', () => {
  it('p1 and p2 share no creature names (seed 1)', () => {
    const { p1Deck, p2Deck } = mintDeckPair(mulberry32(1), 13);
    expect(p1Deck.length).toBe(13);
    expect(p2Deck.length).toBe(13);
    expect(decksDisjoint(p1Deck, p2Deck)).toBe(true);
  });

  it('still disjoint across 25 random seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { p1Deck, p2Deck } = mintDeckPair(mulberry32(seed), 13);
      expect(decksDisjoint(p1Deck, p2Deck)).toBe(true);
    }
  });

  it('decks contain valid Creature objects with tags + ability', () => {
    const { p1Deck } = mintDeckPair(mulberry32(7), 13);
    for (const c of p1Deck) {
      expect(typeof c.name).toBe('string');
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.ability).toBeDefined();
      expect(typeof c.ability.name).toBe('string');
      expect(Array.isArray(c.ability.effects)).toBe(true);
      expect(c.ability.effects.length).toBeGreaterThan(0);
    }
  });
});
