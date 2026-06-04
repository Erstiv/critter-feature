// CLI session-transcript helper — `npm run game`
//
// Replays a scripted v0.2 bout from a JSON file and prints the public log.
// Helps Elliot understand the action shapes during paper iteration.
//
// Usage:
//   npx tsx scripts/play.ts --example          # built-in demo session
//   npx tsx scripts/play.ts --file my.json     # custom session
//   npx tsx scripts/play.ts --example > out.txt
//
// JSON format (see EXAMPLE_SCRIPT below for a full sample):
//   {
//     "seed": 42,
//     "p1Deck": ["Tardigrade", "Sea Otter", "Jaguar", "Raven", "Scorpion"],
//     "p2Deck": ["Peregrine Falcon", "Sea Otter", "Tardigrade", "Saltwater Crocodile", "Giant Squid"],
//     "arenas": ["Ice/Arctic", "Sky", "Wetland/Mud", "Plains", "Jungle"],
//     "firstPlayer": "p1",
//     "actions": [
//       { "player": "p1", "action": { "kind": "Garrison", "cardName": "Tardigrade", "arena": 2, "placeAce": true } },
//       { "player": "p1", "action": { "kind": "EndTurn" } },
//       ...
//     ]
//   }

import { readFileSync } from 'node:fs';
import { applyAction, newGame, playerView, type Action, type PlayerId, type GameState } from '../src/game/index.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import { STARTER_BY_NAME } from '../src/data/starter8.ts';
import type { Creature, Biome } from '../src/types.ts';

type ScriptFile = {
  seed: number;
  p1Deck: string[];
  p2Deck: string[];
  arenas?: Biome[];
  firstPlayer?: PlayerId;
  actions: { player: PlayerId; action: Action }[];
};

const EXAMPLE_SCRIPT: ScriptFile = {
  seed: 42,
  p1Deck: ['Tardigrade', 'Sea Otter', 'Jaguar', 'Raven', 'Scorpion'],
  p2Deck: ['Peregrine Falcon', 'Saltwater Crocodile', 'Tardigrade', 'Giant Squid', 'Scorpion'],
  arenas: ['Ice/Arctic', 'Sky', 'Wetland/Mud', 'Plains', 'Jungle'],
  firstPlayer: 'p1',
  actions: [
    // T1: p1 garrisons Tardigrade in the wetland (declares "Sea Otter" as a bluff),
    //     places the Ace token under it. End turn.
    { player: 'p1', action: { kind: 'Garrison', cardName: 'Tardigrade', arena: 2, declaration: 'Sea Otter', placeAce: true } },
    { player: 'p1', action: { kind: 'EndTurn' } },

    // T2: p2 garrisons Peregrine in Sky (its Home).
    { player: 'p2', action: { kind: 'Garrison', cardName: 'Peregrine Falcon', arena: 1 } },
    { player: 'p2', action: { kind: 'EndTurn' } },

    // T3: p1 strikes the empty Jungle arena with Jaguar from hand → uncontested banner.
    { player: 'p1', action: { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Jaguar', targetArena: 4 } },
    { player: 'p1', action: { kind: 'EndTurn' } },

    // T4: p2 sniffs the wetland to gather info. (Peregrine isn't a [Mind] critter so just 1 tag.)
    { player: 'p2', action: { kind: 'Scout', targetPlayer: 'p1', targetArena: 2, scoutKind: 'Sniff' } },
    { player: 'p2', action: { kind: 'EndTurn' } },

    // T5: p1 calls the bluff — p1 garrisoned in arena 2 and declared "Sea Otter".
    //     p2 hasn't placed anything yet to call. Skip — strike empty Plains instead.
    { player: 'p1', action: { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Sea Otter', targetArena: 3 } },
    { player: 'p1', action: { kind: 'EndTurn' } },

    // T6: p2 strikes p1's wetland Tardigrade with Salty Croc (Wetland is Croc's Home).
    { player: 'p2', action: { kind: 'Strike', sourceArena: 'hand', sourceCardName: 'Saltwater Crocodile', targetArena: 2 } },
  ],
};

function formatEvent(e: any, names: { p1: string[]; p2: string[] }): string {
  switch (e.t) {
    case 'turn-start':
      return `\n=== Turn ${e.turnNumber} — ${e.player.toUpperCase()} ===`;
    case 'turn-end':
      return `  → ${e.player} ends turn.`;
    case 'garrison':
      return `  ${e.player} garrisons at arena ${e.arena}${e.declared ? ` (declares "${e.declared}")` : ''}.`;
    case 'declare':
      return `  ${e.player} declares arena ${e.arena} as "${e.declaration}".`;
    case 'scout':
      return `  ${e.asker} ${e.kind} on ${e.target}'s arena ${e.arena} (cost ${e.cost}).`;
    case 'scout-result-private':
      // Private to asker — but we show in this transcript for the table read.
      if (e.result.kind === 'Sniff') return `    [private to ${e.asker}] Sniff → tags [${e.result.tags.join(', ')}]`;
      if (e.result.kind === 'Probe') return `    [private to ${e.asker}] Probe "${e.result.query}" → ${e.result.answer ? 'YES' : 'no'}`;
      if (e.result.kind === 'DeepScout') return `    [private to ${e.asker}] Deep Scout → ${e.result.cardName}`;
      return '';
    case 'strike':
      return `  ${e.attacker} strikes arena ${e.arena}: ${e.attackerName} vs ${e.defenderName ?? '(empty)'}`;
    case 'strike-result': {
      const result = e.winner === 'tie' ? 'TIE — attacker bounces, defender holds' : `${e.winner} wins (${e.aHits}-${e.bHits})`;
      const burned = e.burned.length ? `; burned: ${e.burned.join(', ')}` : '';
      const ace = e.aceBurned ? '; 🦂 ACE BURNED' : '';
      const banner = e.bannerOwner ? `; banner → ${e.bannerOwner}` : '';
      return `  → ${result}${burned}${banner}${ace}`;
    }
    case 'call':
      return `  ${e.caller} CALLS ${e.target}'s arena ${e.arena} → ${e.wasTrue ? 'truth (penalty)' : 'BLUFF (burned)'}`;
    case 'redeploy':
      return `  ${e.player} redeploys ${e.from} → ${e.to}.`;
    case 'draw':
      return `  ${e.player} draws ${e.cards}.`;
    case 'win':
      return `\n>>> ${e.player.toUpperCase()} WINS by ${e.condition.toUpperCase()}.`;
  }
  return JSON.stringify(e);
}

function dumpBoard(state: GameState, asker: PlayerId): string[] {
  const view = playerView(state, asker);
  const lines: string[] = [];
  lines.push(`  ${asker} view —`);
  lines.push(`    hand (${view.myHand.length}): [${view.myHand.map((c) => c.name).join(', ')}]`);
  lines.push(`    scout tokens: ${view.myScoutTokens}  free sniffs: ${state.players[asker].freeSniffsRemaining}`);
  for (const a of view.arenas) {
    const myG = view.myGarrisons.find((g) => g.arena === a.index);
    const oppG = view.opponent.garrisons.find((g) => g.arena === a.index);
    const myStr = myG ? `[${myG.card.creature.name}${myG.isAce ? '★' : ''}${myG.dugIn ? '⛺' : ''}]` : '·';
    const oppStr = oppG?.hidden
      ? `[hidden${'sniffedTags' in oppG && oppG.sniffedTags.length ? ` (${oppG.sniffedTags.join(',')})` : ''}${oppG.declared ? ` "${oppG.declared}"` : ''}]`
      : (oppG ? `[${(oppG as any).cardName}]` : '·');
    const banner = a.banner ? ` 🏴${a.banner}` : '';
    lines.push(`    A${a.index} ${a.biome}: ${asker}=${myStr} opp=${oppStr}${banner}`);
  }
  return lines;
}

function resolveDeck(names: string[]): Creature[] {
  return names.map((n) => {
    const c = STARTER_BY_NAME.get(n);
    if (!c) throw new Error(`Unknown creature: ${n}`);
    return c;
  });
}

function run(scriptFile: ScriptFile): void {
  const rand = mulberry32(scriptFile.seed);
  const opts: Parameters<typeof newGame>[0] = {
    p1Deck: resolveDeck(scriptFile.p1Deck),
    p2Deck: resolveDeck(scriptFile.p2Deck),
    rand,
  };
  if (scriptFile.arenas) opts.arenas = scriptFile.arenas;
  if (scriptFile.firstPlayer) opts.firstPlayer = scriptFile.firstPlayer;

  let state = newGame(opts);

  console.log(`=== Critter Feature v0.2 — session transcript (seed ${scriptFile.seed}) ===`);
  console.log(`Arenas: ${state.arenas.map((a, i) => `${i}=${a.biome}`).join(' · ')}`);
  console.log(`p1 deck: ${scriptFile.p1Deck.join(', ')}`);
  console.log(`p2 deck: ${scriptFile.p2Deck.join(', ')}`);

  let printedCursor = 0;
  function flushLog() {
    const newEvents = state.log.slice(printedCursor);
    for (const e of newEvents) {
      const line = formatEvent(e, { p1: scriptFile.p1Deck, p2: scriptFile.p2Deck });
      if (line) console.log(line);
    }
    printedCursor = state.log.length;
  }
  flushLog();

  for (const { player, action } of scriptFile.actions) {
    const r = applyAction(state, player, action, rand);
    if (!r.ok) {
      console.error(`\nERROR @ ${player} ${JSON.stringify(action)}: ${r.error}`);
      console.error(`State at error:`);
      for (const l of dumpBoard(state, player)) console.error(l);
      process.exit(2);
    }
    state = r.state;
    flushLog();
    if (state.winner) break;
  }

  console.log('\n=== Final board ===');
  for (const l of dumpBoard(state, 'p1')) console.log(l);
  console.log('  ---');
  for (const l of dumpBoard(state, 'p2')) console.log(l);
}

function main() {
  const args = process.argv.slice(2);
  let script: ScriptFile;
  if (args.includes('--example') || args.length === 0) {
    script = EXAMPLE_SCRIPT;
  } else if (args.includes('--file')) {
    const path = args[args.indexOf('--file') + 1];
    if (!path) {
      console.error('--file requires a path');
      process.exit(1);
    }
    script = JSON.parse(readFileSync(path, 'utf8'));
  } else {
    console.error('Usage: npm run game -- --example | --file path.json');
    process.exit(1);
  }
  run(script);
}

main();
