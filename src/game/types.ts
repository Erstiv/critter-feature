// v0.2 "Hide the Tardigrade" — hidden-information board game types.
// Spec: /Users/JERS/CritterFeature_v0.2_HideTheTardigrade_Spec.md
//
// Vocabulary lock (from spec + the briefing memos):
//   - Feature  = the match (whole game; cowork's in-world word for "bout")
//   - Bill     = a critter card
//   - Strike   = one combat action; resolves via the engine's `resolveLeg` (best-of-1)
//   - Garrison = a critter placed face-down in an arena
//   - Ace      = each player's hidden champion token, tucked under one garrison
//
// All open-design decisions are marked TBD(cowork-227c338b) so the call site is
// findable when the answers land.

import type { Biome, Card, Creature, Tag } from '../types.ts';

export type PlayerId = 'p1' | 'p2';
export const PLAYERS: PlayerId[] = ['p1', 'p2'];

export function otherPlayer(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1';
}

// ──────────────────────────────────────────────────────────────────────
// GARRISON — a Card instance committed to an arena.
// ──────────────────────────────────────────────────────────────────────

export type Garrison = {
  id: string;              // unique instance id within a Feature
  owner: PlayerId;
  card: Card;              // derived from a Creature; cards are immutable
  arena: number;           // 0..arenas.length-1
  hidden: boolean;         // face-down to the OTHER player
  dugIn: boolean;          // pre-garrisoned ≥1 full turn → +2 dice + ambush in strikes
  isAce: boolean;          // marked Ace; only true for one garrison per player
  woundOffset: number;     // cumulative −stamina cap from won strikes; never below 0 effective
  declaration?: string;    // last public declaration ("I name this Tardigrade") — for Calls
  declaredTrue?: boolean;  // true iff declaration matched the card name (for resolveCall)
};

// Effective stamina cap after wounds. Engine reads this when staging a strike.
export function effectiveStaminaCap(g: Garrison): number {
  return Math.max(0, g.card.stamina - g.woundOffset);
}

// ──────────────────────────────────────────────────────────────────────
// ARENA — a biome slot on the slate. 5 of these per Feature (3-6p uses 5-7).
// ──────────────────────────────────────────────────────────────────────

export type Arena = {
  index: number;
  biome: Biome;
  banner: PlayerId | null;          // who controls it (planted via strike win)
  garrisons: Record<PlayerId, Garrison | null>;  // up to 1 per player per arena
};

// ──────────────────────────────────────────────────────────────────────
// SCOUT — the recon resource. Tokens are scarce; [Mind] critters cheapen.
// ──────────────────────────────────────────────────────────────────────

export type ScoutKind = 'Sniff' | 'Probe' | 'DeepScout';

// Base scout costs (tokens).
export const SCOUT_COST: Record<ScoutKind, number> = {
  Sniff: 1,
  Probe: 1,
  DeepScout: 2,
};

// [Mind] recon modifier — TBD(cowork-227c338b/Q6): locked starting table for v0.2,
// expand by design memo. Slime Mold [Mindless] does NOT count.
export type MindBonus = {
  name: string;                                   // creature name (matches Creature.name)
  sniffRevealsTags?: number;                      // Raven: 2 (default 1)
  freeSniffsPerTurn?: number;                     // Octopus: 1
  probeCostOverride?: number | undefined;
  deepScoutCostOverride?: number | undefined;
};

export const MIND_RECON: Record<string, MindBonus> = {
  Raven: { name: 'Raven', sniffRevealsTags: 2 },
  Octopus: { name: 'Octopus', freeSniffsPerTurn: 1 },
};

// What a scout returns to the asker. Asker is the only one who sees the result.
export type ScoutResult =
  | { kind: 'Sniff'; tags: Tag[] }                // 1 (or N for Raven) tags revealed
  | { kind: 'Probe'; query: string; answer: boolean }
  | { kind: 'DeepScout'; cardName: string; card: Card };

// ──────────────────────────────────────────────────────────────────────
// PLAYER STATE — per-player resources and visibility.
// ──────────────────────────────────────────────────────────────────────

export type PlayerState = {
  id: PlayerId;
  deck: Creature[];               // shuffled, draw from end
  hand: Creature[];               // up to handCap (see config)
  discard: Creature[];            // burned critters land here for tracking
  scoutTokens: number;
  freeSniffsRemaining: number;    // Octopus-style bonus, refilled at turn start
  aceGarrisonId: string | null;   // which garrison holds the Ace token
};

// ──────────────────────────────────────────────────────────────────────
// VISIBILITY — what one player sees about the opponent at any moment.
// ──────────────────────────────────────────────────────────────────────

export type GarrisonView =
  | {
      hidden: true;
      arena: number;
      sniffedTags: Tag[];
      declared?: string;
      // Deep Scout result, if the asker has performed one on this garrison. The
      // opp doesn't know the asker peeked — but the asker carries the knowledge.
      deepScoutedName?: string;
      deepScoutedCard?: Card;
    }
  | { hidden: false; arena: number; cardName: string; card: Card };          // revealed (by strike or Call)

export type PlayerView = {
  me: PlayerId;
  myGarrisons: Garrison[];
  myHand: Creature[];
  myDeckSize: number;
  myScoutTokens: number;
  myAceGarrisonId: string | null;

  arenas: { index: number; biome: Biome; banner: PlayerId | null }[];
  opponent: {
    handSize: number;
    deckSize: number;
    scoutTokens: number;
    garrisons: GarrisonView[];
    discard: Creature[];
  };

  // Public record (no hidden info): declarations, scout actions taken, strike log.
  log: GameEvent[];
};

// ──────────────────────────────────────────────────────────────────────
// ACTIONS — what a player can submit on their turn.
// ──────────────────────────────────────────────────────────────────────

export type Action =
  | { kind: 'Garrison'; cardName: string; arena: number; declaration?: string; placeAce?: boolean }
  | { kind: 'Scout'; targetPlayer: PlayerId; targetArena: number; scoutKind: ScoutKind; probeQuery?: string }
  | { kind: 'Strike'; sourceArena: number | 'hand'; sourceCardName?: string; targetArena: number }
  | { kind: 'Redeploy'; fromArena: number; toArena: number }
  | { kind: 'Declare'; arena: number; declaration: string }   // re-declare/double down (free)
  | { kind: 'Call'; targetPlayer: PlayerId; targetArena: number }   // bluff-test the prior declaration
  | { kind: 'EndTurn' };  // explicit pass after the one main action + draw

// ──────────────────────────────────────────────────────────────────────
// GAME EVENTS — public ledger for the bout log + replay.
// ──────────────────────────────────────────────────────────────────────

export type GameEvent =
  | { t: 'turn-start'; player: PlayerId; turnNumber: number }
  | { t: 'garrison'; player: PlayerId; arena: number; declared?: string }
  | { t: 'scout'; asker: PlayerId; target: PlayerId; arena: number; kind: ScoutKind; cost: number }
  | { t: 'scout-result-private'; asker: PlayerId; result: ScoutResult }   // private to asker; filtered out of opponent views
  | { t: 'declare'; player: PlayerId; arena: number; declaration: string }
  | { t: 'call'; caller: PlayerId; target: PlayerId; arena: number; wasTrue: boolean; outcome: 'caller-wins-arena' | 'caller-loses-token-and-reveals' }
  | { t: 'strike'; attacker: PlayerId; defender: PlayerId; arena: number; attackerName: string; defenderName: string | null }
  | { t: 'strike-result'; attacker: PlayerId; defender: PlayerId; arena: number; winner: PlayerId | 'tie'; aHits: number; bHits: number; burned: string[]; bannerOwner: PlayerId | null; aceBurned: boolean; legLog: string[] }
  | { t: 'redeploy'; player: PlayerId; from: number; to: number }
  | { t: 'draw'; player: PlayerId; cards: number }
  | { t: 'turn-end'; player: PlayerId }
  | { t: 'win'; player: PlayerId; condition: 'glory' | 'endurance' | 'assassination' };

// ──────────────────────────────────────────────────────────────────────
// CONFIG — the tuning knobs from §14. Defaults below, all overridable.
// ──────────────────────────────────────────────────────────────────────

export type GameConfig = {
  deckSize: number;            // §14 dial; default 15
  startingHandSize: number;    // §3.2: draw 5 (one-time setup)
  handCap: number;             // Cowork ce5b3456 Q3: ongoing draw caps at 3
  scoutTokensPerPlayer: number;// §3.5: 3
  arenaCount: number;          // §3.1: 5
  dugInDiceBonus: number;      // Cowork ce5b3456 Q7: +2, full stop. Primary playtest dial.
  winnerWoundsPerStrike: number; // §5.5: 1
  majorityForGlory: number;    // §8: 3 (of 5)
  aceDieBonus: number;         // §7: +1 die defending
  aceBurnRevealsAll: boolean;  // §7: true
  aceBurnGrantsFreeBanner: boolean; // §7: true
};

export const DEFAULT_CONFIG: GameConfig = {
  deckSize: 15,
  startingHandSize: 5,
  handCap: 3,                  // Cowork ce5b3456 Q3
  scoutTokensPerPlayer: 3,
  arenaCount: 5,
  dugInDiceBonus: 2,
  winnerWoundsPerStrike: 1,
  majorityForGlory: 3,
  aceDieBonus: 1,
  aceBurnRevealsAll: true,
  aceBurnGrantsFreeBanner: true,
};

// ──────────────────────────────────────────────────────────────────────
// GAME STATE — full game-master view; private to the engine controller.
// ──────────────────────────────────────────────────────────────────────

export type GameState = {
  config: GameConfig;
  turn: number;                // 1-indexed
  activePlayer: PlayerId;
  actionTakenThisTurn: boolean;// each turn: one main action + draw + end
  players: Record<PlayerId, PlayerState>;
  arenas: Arena[];
  garrisons: Garrison[];       // flat list keyed by id; arenas reference these too
  log: GameEvent[];
  winner: PlayerId | null;
  winCondition: 'glory' | 'endurance' | 'assassination' | null;
};
