// Cassius Vane commentary bank — delivered by cowork in memo d4a5dc89.
// Register: B-movie ringside barker — punchy, lurid, fun. Same line shown to both
// players (one's triumph is the other's obituary).

import type { GameEvent } from '../../../src/game/index.ts';

type StrikeResult = Extract<GameEvent, { t: 'strike-result' }>;
type StrikeReq = Extract<GameEvent, { t: 'strike' }>;

const WINNER_DECISIVE = [
  "{winner} didn't fight {loser} on the {biome} — it filed the paperwork.",
  "They'll be scraping {loser} off the {biome} for a week. {winner}: not a scratch.",
  "{loser} came to the {biome} with a plan. {winner} came with an appetite.",
  "Over before the dust settled. The {biome} belongs to {winner}; the grave belongs to {loser}.",
];

const WINNER_NARROW = [
  "Closest thing to a coin-flip the {biome}'s ever seen — and it landed on {winner}.",
  "One more leg and it's {loser}'s night. It wasn't. {winner} survives the {biome}.",
  "{winner} limps off the {biome} a winner; {loser} just limps off.",
  "Two hits and a prayer — {winner} takes the {biome} by a whisker, {loser} by a wound.",
];

const TIE_BOUNCE = [
  "{loser} hammered the {biome} and the {biome} hammered back. Nobody falls; the line holds.",
  "You can't dislodge what won't be dislodged. {loser} bounces off the {biome} and trudges home.",
  "Dead even — so the dug-in critter keeps the dirt, and {loser} keeps the walk of shame.",
];

const EMPTY_ARENA = [
  "{winner} strolls into an empty {biome} and plants the flag. Nobody home, nobody to argue.",
  "An undefended {biome} is just real estate. {winner} took the deed.",
];

const ACE_BURN = [
  "★ THE ACE FALLS ★ {loser} was the hidden champion all along — and {winner} dragged it into the light and ended it on the {biome}.",
  "They hid their best in the dark. The dark gave it up. {winner} burns the Ace, and the floor goes out from under {loser}.",
  "Assassination on the {biome}. {winner} found the one critter that mattered and made an example of it.",
];

const MIND_COUNTER = [
  "{winner} read the trick before it was thrown — you don't spook the thing that counts the wings. {loser} undone on the {biome}.",
];

const MENACE_NULL = [
  "{loser} brought terror to a thing with no fear to give. The menace bounced; {winner} didn't blink on the {biome}.",
];

const WOUND_EROSION = [
  "{winner} holds the {biome} — but leaves skin on it. Every win costs a little more.",
  "Another notch, another wound. {winner} keeps the {biome} and bleeds the victory.",
];

const MATCH_END_GLORY = [
  "THAT'S THE BILL. {winner} holds the room — three arenas, one night, total control. Roll credits.",
];

const MATCH_END_ENDURANCE = [
  "{loser} reached for a critter and found an empty cage. {winner} wins the way the water-bear taught us — last one standing in the dark.",
];

const MATCH_END_ASSASSINATION = [
  "★ MAIN EVENT KILL ★ {winner} hunted the hidden one through the whole card and put it down. {loser}'s champion is ash. That's how a Feature ends — grizzly, and on purpose.",
];

function pick<T>(arr: T[], salt: number): T {
  return arr[Math.abs(salt) % arr.length]!;
}

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export type CommentaryInput = {
  strikeReq: StrikeReq;
  strikeResult: StrikeResult;
  biome: string;
  attackerName: string;
  defenderName: string | null;
  // Optional contextual hints — the caller passes what it knows.
  defenderTags?: string[];      // for menace-null, mind-counter, etc.
  attackerHadMenace?: boolean;
  defenderHadMind?: boolean;
};

export function strikeCommentary(input: CommentaryInput, salt: number): string {
  const { strikeResult, biome, attackerName, defenderName } = input;
  // EMPTY ARENA: no defender.
  if (defenderName === null) {
    return format(pick(EMPTY_ARENA, salt), { winner: attackerName, biome });
  }
  // TIE.
  if (strikeResult.winner === 'tie') {
    return format(pick(TIE_BOUNCE, salt), { loser: attackerName, biome });
  }
  const winner = strikeResult.winner === strikeResult.attacker ? attackerName : defenderName;
  const loser = strikeResult.winner === strikeResult.attacker ? defenderName : attackerName;
  // ACE-BURN spectacle takes precedence.
  if (strikeResult.aceBurned) {
    return format(pick(ACE_BURN, salt), { winner, loser, biome });
  }
  // Special-case lore counters when we can detect them from inputs.
  if (input.attackerHadMenace && input.defenderTags?.some((t) => t === 'Fearless' || t === 'Mind')) {
    return format(pick(MENACE_NULL, salt), { winner, loser, biome });
  }
  if (input.defenderHadMind && strikeResult.winner === strikeResult.defender) {
    return format(pick(MIND_COUNTER, salt), { winner, loser, biome });
  }
  // Decisive vs narrow vs wound-erosion (rough: wide margin = decisive, 1-pt margin = narrow).
  const margin = Math.abs(strikeResult.aHits - strikeResult.bHits);
  if (margin >= 3) {
    return format(pick(WINNER_DECISIVE, salt), { winner, loser, biome });
  }
  if (margin <= 1) {
    return format(pick(WINNER_NARROW, salt), { winner, loser, biome });
  }
  // Fallback: a quietly-paid victory — wound-erosion flavor.
  return format(pick(WOUND_EROSION, salt), { winner, loser, biome });
}

export function winCommentary(condition: 'glory' | 'endurance' | 'assassination', winner: string, loser: string, salt: number): string {
  let bank: string[];
  if (condition === 'glory') bank = MATCH_END_GLORY;
  else if (condition === 'endurance') bank = MATCH_END_ENDURANCE;
  else bank = MATCH_END_ASSASSINATION;
  return format(pick(bank, salt), { winner, loser });
}
