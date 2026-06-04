// Filter the full GameState down to one player's PlayerView (hidden info enforced).
//
// THE central guarantee of v0.2: the only way a player learns about an opponent
// is through public events (declarations, strike reveals) or scout-result-private
// events ADDRESSED TO THEM. All other hidden state is stripped before serializing.

import type { GameEvent, GameState, GarrisonView, PlayerId, PlayerView } from './types.ts';
import { otherPlayer } from './types.ts';

// Public events anyone can see. Scout *requests* are public (you saw them spend a
// token), but the RESULT is only delivered to the asker.
function isPubliclyVisible(e: GameEvent): boolean {
  switch (e.t) {
    case 'scout-result-private':
      return false;
    default:
      return true;
  }
}

// Reveals delivered to a specific asker.
function isAskerPrivate(e: GameEvent, asker: PlayerId): boolean {
  return e.t === 'scout-result-private' && e.asker === asker;
}

export function playerView(state: GameState, me: PlayerId): PlayerView {
  const them = otherPlayer(me);
  const myPlayer = state.players[me];
  const oppPlayer = state.players[them];

  const myGarrisons = state.garrisons.filter((g) => g.owner === me);

  // Build opponent garrison views: hidden by default unless an earlier reveal
  // (strike, Call, Deep Scout result) flipped them face-up.
  const oppGarrisons: GarrisonView[] = state.garrisons
    .filter((g) => g.owner === them)
    .map((g) => {
      // Surface partial reveals from scouts addressed to me.
      const sniffedTags = collectSniffedTagsFor(state.log, me, them, g.arena);
      if (!g.hidden) {
        return { hidden: false, arena: g.arena, cardName: g.card.creature.name, card: g.card };
      }
      const v: GarrisonView = { hidden: true, arena: g.arena, sniffedTags };
      if (g.declaration !== undefined) v.declared = g.declaration;
      return v;
    });

  const filteredLog = state.log.filter((e) => isPubliclyVisible(e) || isAskerPrivate(e, me));

  return {
    me,
    myGarrisons,
    myHand: myPlayer.hand.slice(),
    myDeckSize: myPlayer.deck.length,
    myScoutTokens: myPlayer.scoutTokens,
    myAceGarrisonId: myPlayer.aceGarrisonId,

    arenas: state.arenas.map((a) => ({ index: a.index, biome: a.biome, banner: a.banner })),
    opponent: {
      handSize: oppPlayer.hand.length,
      deckSize: oppPlayer.deck.length,
      scoutTokens: oppPlayer.scoutTokens,
      garrisons: oppGarrisons,
      discard: oppPlayer.discard.slice(),
    },
    log: filteredLog,
  };
}

function collectSniffedTagsFor(log: GameEvent[], me: PlayerId, target: PlayerId, arena: number): import('../types.ts').Tag[] {
  const tags = new Set<import('../types.ts').Tag>();
  for (const e of log) {
    if (e.t === 'scout-result-private' && e.asker === me && e.result.kind === 'Sniff') {
      // We can't easily attach arena to the result without back-walking;
      // pair-up with the corresponding `scout` event right before it.
      // For now, infer by adjacency.
      const idx = log.indexOf(e);
      const req = log[idx - 1];
      if (req && req.t === 'scout' && req.asker === me && req.target === target && req.arena === arena) {
        for (const t of e.result.tags) tags.add(t);
      }
    }
  }
  return Array.from(tags);
}
