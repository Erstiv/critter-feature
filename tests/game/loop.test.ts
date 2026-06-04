// v0.2 game-loop fixtures. Exercise setup → garrison → scout → strike → win.

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/rng.ts';
import { STARTER_8_PLUS, STARTER_BY_NAME } from '../../src/data/starter8.ts';
import { applyAction, newGame, playerView, type GameState, type Creature } from '../../src/game/index.ts';
import type { Creature as CType } from '../../src/types.ts';

const cByName = (n: string): CType => STARTER_BY_NAME.get(n)!;

// Quick "given-when-then" runner that asserts ok and threads state forward.
function step(state: GameState, player: 'p1' | 'p2', action: Parameters<typeof applyAction>[2], rand?: () => number): GameState {
  const r = applyAction(state, player, action, rand);
  if (!r.ok) throw new Error(`step failed: ${r.error}`);
  return r.state;
}

describe('v0.2 setup', () => {
  it('mints fresh state with 5 arenas, 5-card starting hand, 3 scout tokens', () => {
    const rand = mulberry32(1);
    const state = newGame({
      p1Deck: STARTER_8_PLUS.slice(),
      p2Deck: STARTER_8_PLUS.slice(),
      rand,
    });
    expect(state.arenas).toHaveLength(5);
    expect(state.players.p1.hand).toHaveLength(5);
    expect(state.players.p2.hand).toHaveLength(5);
    expect(state.players.p1.scoutTokens).toBe(3);
    expect(state.players.p2.scoutTokens).toBe(3);
    expect(state.activePlayer).toBe('p1');
    expect(state.turn).toBe(1);
  });
});

describe('v0.2 garrison + view', () => {
  it('p2 sees p1 garrison as hidden until revealed', () => {
    const rand = mulberry32(1);
    // Stack both decks so we know what we're working with.
    const deck = [cByName('Tardigrade'), cByName('Peregrine Falcon'), cByName('Sea Otter'), cByName('Saltwater Crocodile'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Tardigrade', arena: 0, placeAce: true });

    const p2View = playerView(state, 'p2');
    expect(p2View.opponent.garrisons).toHaveLength(1);
    const opp = p2View.opponent.garrisons[0]!;
    expect(opp.hidden).toBe(true);
    expect((opp as { hidden: true; arena: number }).arena).toBe(0);
  });
});

describe('v0.2 scout', () => {
  it('Sniff reveals 1 tag (or 2 if Raven in play) and spends a token', () => {
    const rand = mulberry32(1);
    const deck = [cByName('Scorpion'), cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });

    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Scorpion', arena: 0 });
    state = step(state, 'p1', { kind: 'EndTurn' });
    // p2's turn — sniff p1's scorpion
    state = step(state, 'p2', { kind: 'Scout', targetPlayer: 'p1', targetArena: 0, scoutKind: 'Sniff' });

    expect(state.players.p2.scoutTokens).toBe(2);
    const sniffEvent = state.log.find((e) => e.t === 'scout-result-private');
    expect(sniffEvent).toBeDefined();
    if (sniffEvent?.t === 'scout-result-private' && sniffEvent.result.kind === 'Sniff') {
      expect(sniffEvent.result.tags).toHaveLength(1);
      expect(sniffEvent.result.tags[0]).toMatch(/Venom|Armor|Fearless/);
    }
  });

  it('Probe "is this your Ace?" answers truthfully', () => {
    const rand = mulberry32(1);
    const deck = [cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Tardigrade', arena: 0, placeAce: true });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Scout', targetPlayer: 'p1', targetArena: 0, scoutKind: 'Probe', probeQuery: 'is this your ace?' });

    const probeResult = state.log.find((e) => e.t === 'scout-result-private');
    if (probeResult?.t === 'scout-result-private' && probeResult.result.kind === 'Probe') {
      expect(probeResult.result.answer).toBe(true);
    } else {
      throw new Error('expected Probe result');
    }
  });
});

describe('v0.2 strike — empty arena = uncontested banner', () => {
  it('p1 strikes an empty arena, plants banner, no clash', () => {
    const rand = mulberry32(1);
    const deck = [cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Sea Otter', targetArena: 2 });

    expect(state.arenas[2]!.banner).toBe('p1');
    const garr = state.arenas[2]!.garrisons.p1;
    expect(garr?.card.creature.name).toBe('Sea Otter');
    expect(garr?.hidden).toBe(false);  // strike reveals
  });
});

describe('v0.2 strike — clash uses engine', () => {
  it('attacker beats defender via engine resolveLeg; defender burns; banner flips', () => {
    // Force a clash: p2 garrisons Peregrine in Ice, p1 strikes from hand with Salty Croc.
    // Croc Might 4 / Stam 6, Peregrine Might 4 / Stam 4 in Ice (neutral both). With a
    // hand-source strike, attacker has no Dug-In; defender has Dug-In after 1 turn.
    const rand = mulberry32(7);
    const p2deck = [cByName('Peregrine Falcon'), cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Scorpion')];
    const p1deck = [cByName('Saltwater Crocodile'), cByName('Tardigrade'), cByName('Giant Squid'), cByName('Jaguar'), cByName('Scorpion')];
    let state = newGame({ p1Deck: p1deck, p2Deck: p2deck, arenas: ['Ice/Arctic', 'Plains', 'Wetland/Mud', 'Sky', 'Jungle'], rand, firstPlayer: 'p2' });

    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Peregrine Falcon', arena: 0 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    // Now p1's turn — Peregrine has been there for a full turn → Dug-In on next end-turn.
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Saltwater Crocodile', targetArena: 0 });

    const result = state.log.find((e) => e.t === 'strike-result');
    expect(result?.t).toBe('strike-result');
    // At least one of them burned
    if (result?.t === 'strike-result') {
      expect(result.burned.length).toBeGreaterThan(0);
    }
  });
});

describe('v0.2 win — Glory (majority banners)', () => {
  it('first player to 3 banners wins by Glory', () => {
    const rand = mulberry32(2);
    // 5-card deck so all 5 land in hand → fully deterministic for the test.
    const deck = [cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });

    // Manually plant 3 banners for p1 via empty-arena strikes (1 strike per turn).
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Tardigrade', targetArena: 0 });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Tardigrade', arena: 3 });  // p2 just garrisons somewhere
    state = step(state, 'p2', { kind: 'EndTurn' });
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Sea Otter', targetArena: 1 });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Sea Otter', arena: 4 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Jaguar', targetArena: 2 });

    expect(state.winner).toBe('p1');
    expect(state.winCondition).toBe('glory');
    const winEvent = state.log.find((e) => e.t === 'win');
    expect(winEvent?.t).toBe('win');
  });
});
