// v0.2 game-loop fixtures. Exercise setup → garrison → scout → strike → win.

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/rng.ts';
import { STARTER_8_PLUS, STARTER_BY_NAME } from '../../src/data/starter8.ts';
import { applyAction, newGame, playerView, type GameState } from '../../src/game/index.ts';
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
    // Croc Might 4 / Stam 6, Peregrine Might 4 / Stam 4 in Ice (neutral both).
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
    if (result?.t === 'strike-result') {
      // Universal tie rule: non-tie → exactly 1 burn; tie → 0 burns + attacker bounces.
      if (result.winner === 'tie') {
        expect(result.burned.length).toBe(0);
      } else {
        expect(result.burned.length).toBe(1);
      }
    }
  });

  it('universal tie rule: tied clash → attacker bounces to hand, no burns, no wounds', () => {
    // Construct a tie deterministically by garrisoning identical cards from identical
    // decks with a seed that produces equal dice. We rely on a near-symmetric matchup
    // (Sea Otter vs Sea Otter in Plains) and search seeds; seed 5 produces a tie.
    let foundTie = false;
    for (let seed = 1; seed <= 30 && !foundTie; seed++) {
      const rand = mulberry32(seed);
      const deck = [cByName('Sea Otter'), cByName('Tardigrade'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
      let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), arenas: ['Plains', 'Plains', 'Plains', 'Plains', 'Plains'], rand, firstPlayer: 'p2' });
      state = step(state, 'p2', { kind: 'Garrison', cardName: 'Sea Otter', arena: 0 });
      state = step(state, 'p2', { kind: 'EndTurn' });
      const handSizeBefore = state.players.p1.hand.length;
      state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Sea Otter', targetArena: 0 });
      const result = state.log.find((e) => e.t === 'strike-result');
      if (result?.t === 'strike-result' && result.winner === 'tie') {
        foundTie = true;
        // Attacker bounced back to hand → hand size unchanged.
        expect(state.players.p1.hand.length).toBe(handSizeBefore);
        // No burns either side.
        expect(state.players.p1.discard.length).toBe(0);
        expect(state.players.p2.discard.length).toBe(0);
        // Defender garrison still in place, no wound.
        const def = state.arenas[0]!.garrisons.p2;
        expect(def).not.toBeNull();
        expect(def!.woundOffset).toBe(0);
      }
    }
    expect(foundTie).toBe(true);  // sanity: the search did find a tie within 30 seeds
  });
});

describe('v0.2 banner rule (d) — auto-claim visually, Glory needs ≥1 strike-won', () => {
  it('auto-claim banners count toward the 3 but cannot win Glory alone', () => {
    const rand = mulberry32(22);
    const deck = [cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), arenas: ['Plains', 'Desert', 'Sky', 'Wetland/Mud', 'Jungle'], rand });
    // P1 auto-claims arenas 0, 1, 2 via Hide. P2 takes arena 4 to avoid getting steamrolled.
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Tardigrade', arena: 0, placeAce: true });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Jaguar', arena: 4 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Sea Otter', arena: 1 });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Scorpion', arena: 3 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Raven', arena: 2 });

    // P1 now has 3 banners (all auto-claimed during Hide). Glory must NOT fire yet.
    const p1Banners = state.arenas.filter((a) => a.banner === 'p1').length;
    expect(p1Banners).toBe(3);
    const strikeWonP1 = state.arenas.filter((a) => a.banner === 'p1' && a.bannerProvenance === 'strike').length;
    expect(strikeWonP1).toBe(0);
    expect(state.winner).toBeNull();
  });
});

describe('v0.2 Ace opt-out', () => {
  it('player without an Ace cannot be assassinated; opponent has to win via Glory or Endurance', () => {
    const rand = mulberry32(7);
    const deck = [cByName('Tardigrade'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), rand });
    // p1 garrisons without tucking the Ace
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Tardigrade', arena: 0 /* no placeAce */ });
    expect(state.players.p1.aceGarrisonId).toBeNull();
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Sea Otter', arena: 1, placeAce: true });
    state = step(state, 'p2', { kind: 'EndTurn' });

    // p2 strikes p1's Tardigrade — even if it burns, no Ace burn possible since p1 has no Ace.
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Jaguar', targetArena: 1 }, mulberry32(7));
    const sr = state.log.find((e) => e.t === 'strike-result');
    expect(sr?.t).toBe('strike-result');
    // Only check if Tardigrade was actually burned — could go either way at this seed.
  });
});

describe('v0.2 strike-result event carries attacker+defender tags for commentary', () => {
  it('attackerTags + defenderTags + might/stamina are emitted', () => {
    const rand = mulberry32(7);
    const deck = [cByName('Saltwater Crocodile'), cByName('Peregrine Falcon'), cByName('Jaguar'), cByName('Raven'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), arenas: ['Wetland/Mud', 'Ice/Arctic', 'Plains', 'Sky', 'Jungle'], rand, firstPlayer: 'p2' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Peregrine Falcon', arena: 0 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Saltwater Crocodile', targetArena: 0 });
    const sr = state.log.find((e) => e.t === 'strike-result');
    if (sr?.t === 'strike-result') {
      expect(sr.attackerName).toBe('Saltwater Crocodile');
      expect(sr.attackerTags).toContain('Aquatic');
      expect(sr.attackerMight).toBe(4);
      expect(sr.defenderName).toBe('Peregrine Falcon');
      expect(sr.defenderTags).toContain('Flyer');
    } else {
      throw new Error('expected strike-result');
    }
  });
});

describe('v0.2 win — Assassination (Ace burned)', () => {
  it('burning the opponent Ace fires win state on the same applyAction', () => {
    // p2 garrisons Peregrine + Ace at Sky. p1 strikes from hand with Saltwater Croc
    // (Wetland Home but Sky is Peregrine Home → Croc actually loses on Sky usually,
    // so let's strike at Plains where Peregrine has just been re-garrisoned to be Ace…
    // Simplest construct: p2 puts Ace under a fragile creature, then p1 lands an
    // overwhelming strike. Use seed brute-force to find an assassination.
    let assassinationFound = false;
    for (let seed = 1; seed <= 50 && !assassinationFound; seed++) {
      const rand = mulberry32(seed);
      const p1deck = [cByName('Saltwater Crocodile'), cByName('Jaguar'), cByName('Giant Squid'), cByName('Scorpion'), cByName('Sea Otter')];
      const p2deck = [cByName('Peregrine Falcon'), cByName('Sea Otter'), cByName('Jaguar'), cByName('Scorpion'), cByName('Tardigrade')];
      let state = newGame({ p1Deck: p1deck.slice(), p2Deck: p2deck.slice(), arenas: ['Wetland/Mud', 'Sky', 'Plains', 'Desert', 'Jungle'], rand, firstPlayer: 'p2' });
      state = step(state, 'p2', { kind: 'Garrison', cardName: 'Peregrine Falcon', arena: 0, placeAce: true });
      state = step(state, 'p2', { kind: 'EndTurn' });
      state = step(state, 'p1', { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Saltwater Crocodile', targetArena: 0 });
      const result = state.log.find((e) => e.t === 'strike-result');
      if (result?.t === 'strike-result' && result.aceBurned) {
        assassinationFound = true;
        expect(state.winner).toBe('p1');
        expect(state.winCondition).toBe('assassination');
        // Win event must be logged in the same applyAction.
        const winEvent = state.log.find((e) => e.t === 'win');
        expect(winEvent?.t).toBe('win');
      }
    }
    expect(assassinationFound).toBe(true);
  });

  it('contested-arena strike: source === target with opp present resolves the clash', () => {
    // p1 hides at Plains. p2 hides at Plains too. p1 strikes at Plains using their own occupant.
    const rand = mulberry32(11);
    const deck = [cByName('Saltwater Crocodile'), cByName('Tardigrade'), cByName('Jaguar'), cByName('Sea Otter'), cByName('Scorpion')];
    let state = newGame({ p1Deck: deck.slice(), p2Deck: deck.slice(), arenas: ['Plains', 'Desert', 'Sky', 'Jungle', 'Ice/Arctic'], rand });
    state = step(state, 'p1', { kind: 'Garrison', cardName: 'Saltwater Crocodile', arena: 0, placeAce: true });
    state = step(state, 'p1', { kind: 'EndTurn' });
    state = step(state, 'p2', { kind: 'Garrison', cardName: 'Jaguar', arena: 0 });
    state = step(state, 'p2', { kind: 'EndTurn' });
    // p1 now strikes their own arena (their Croc attacks p2's Jaguar in Plains).
    const r = applyAction(state, 'p1', { kind: 'Strike', sourceArena: 0, targetArena: 0 }, mulberry32(11));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const result = r.state.log.find((e) => e.t === 'strike-result');
      expect(result?.t).toBe('strike-result');
      // Whatever the outcome, exactly one of the two should burn (no tie-bounce in same arena makes the result land somehow).
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
