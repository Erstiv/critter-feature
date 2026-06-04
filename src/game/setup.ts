// Feature setup: shuffle deck, deal hand, lay arenas, mint a fresh GameState.

import type { Biome, Creature } from '../types.ts';
import { BIOMES } from '../types.ts';
import {
  DEFAULT_CONFIG,
  type GameConfig,
  type GameState,
  type PlayerId,
  type PlayerState,
  type Arena,
  PLAYERS,
} from './types.ts';

// Fisher-Yates with injected RNG.
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export type NewGameOpts = {
  p1Deck: Creature[];
  p2Deck: Creature[];
  arenas?: Biome[];             // explicit slate; else picked from BIOMES via rand
  config?: Partial<GameConfig>;
  rand: () => number;
  firstPlayer?: PlayerId;
};

function pickArenaSlate(rand: () => number, count: number): Biome[] {
  const pool = shuffle(BIOMES.slice(), rand);
  return pool.slice(0, count);
}

function mintPlayerState(id: PlayerId, deck: Creature[], handSize: number, scoutTokens: number, rand: () => number): PlayerState {
  const shuffled = shuffle(deck, rand);
  const hand = shuffled.splice(0, Math.min(handSize, shuffled.length));
  return {
    id,
    deck: shuffled,
    hand,
    discard: [],
    scoutTokens,
    freeSniffsRemaining: 0,
    aceGarrisonId: null,
  };
}

export function newGame(opts: NewGameOpts): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...(opts.config ?? {}) };

  const slate = (opts.arenas ?? pickArenaSlate(opts.rand, config.arenaCount)).slice(0, config.arenaCount);
  const arenas: Arena[] = slate.map((biome, index) => ({
    index,
    biome,
    banner: null,
    garrisons: { p1: null, p2: null },
  }));

  const p1 = mintPlayerState('p1', opts.p1Deck, config.startingHandSize, config.scoutTokensPerPlayer, opts.rand);
  const p2 = mintPlayerState('p2', opts.p2Deck, config.startingHandSize, config.scoutTokensPerPlayer, opts.rand);

  const firstPlayer = opts.firstPlayer ?? 'p1';

  return {
    config,
    turn: 1,
    activePlayer: firstPlayer,
    actionTakenThisTurn: false,
    players: { p1, p2 },
    arenas,
    garrisons: [],
    log: [{ t: 'turn-start', player: firstPlayer, turnNumber: 1 }],
    winner: null,
    winCondition: null,
  };
}

// Re-export for ergonomic imports.
export { PLAYERS };
