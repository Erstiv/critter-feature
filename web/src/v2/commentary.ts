// Per-strike narrative commentary — placeholder Cassius-Vane-adjacent lines until
// cowork ships the actual voice. Variety driven by (winner, loser, biome, was-tie).
//
// Cowork: replace these arrays + selection logic with your voice when ready.

import type { GameEvent } from '../../../src/game/index.ts';

type StrikeResult = Extract<GameEvent, { t: 'strike-result' }>;
type StrikeReq = Extract<GameEvent, { t: 'strike' }>;

const TIE_LINES = [
  "{att} bounces off {def}'s guard. Both walk it off — the {biome} keeps its silence.",
  "Standoff in the {biome}. {att} reads the room, retreats. {def} doesn't move.",
  "Trade of blows, even-up. {att} backs out; {def} holds the ground.",
];

const WINNER_LINES = [
  "{winner} dismantles {loser} in the {biome}. Old news by morning.",
  "Bad day for {loser}. {winner} took the {biome} clean.",
  "{loser} crumples. {winner} plants the flag and doesn't look back.",
  "The {biome} answered, and the answer was {winner}.",
  "{winner} walks out of the {biome} {wound}. {loser} doesn't walk out at all.",
  "{loser} brought a knife to a {biome}-fight. {winner} brought a {biome}.",
];

const EMPTY_LINES = [
  "{winner} strolls into an empty {biome}. Flag plants, crowd shrugs.",
  "Uncontested. {winner} marks the {biome} as their own.",
  "Nobody home in the {biome}. {winner} settles in.",
];

const ACE_BURN_LINES = [
  "🦂 They went for the throne and FOUND it. {winner} burns {loser}'s Ace — the {biome} hosts an assassination.",
  "🦂 ACE DOWN. {winner} read the bluff perfectly. {loser}'s whole hand falls open.",
  "🦂 The {biome} just hosted a coronation in reverse. {winner} burns the Ace; the rest is mop-up.",
];

const ASSASSINATION_WIN_LINES = [
  "🦂 And just like that, it's over. The Ace is dust.",
  "🦂 A clean kill. The hidden champion never even got to fight.",
];

const GLORY_WIN_LINES = [
  "🏴 Three flags. Game.",
  "🏴 The majority holds. Match over.",
  "🏴 The board belongs to {winner} now.",
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
  woundLevel?: 'wound' | 'bloodied' | 'limping';
};

export function strikeCommentary(input: CommentaryInput, salt: number): string {
  const { strikeResult, biome, attackerName, defenderName } = input;
  if (defenderName === null) {
    // Empty-arena strike.
    return format(pick(EMPTY_LINES, salt), { winner: attackerName, biome });
  }
  if (strikeResult.winner === 'tie') {
    return format(pick(TIE_LINES, salt), { att: attackerName, def: defenderName, biome });
  }
  const winner = strikeResult.winner === strikeResult.attacker ? attackerName : defenderName;
  const loser = strikeResult.winner === strikeResult.attacker ? defenderName : attackerName;
  if (strikeResult.aceBurned) {
    return format(pick(ACE_BURN_LINES, salt), { winner, loser, biome });
  }
  return format(pick(WINNER_LINES, salt), {
    winner, loser, biome,
    wound: input.woundLevel ?? 'bloodied',
  });
}

export function winCommentary(condition: 'glory' | 'endurance' | 'assassination', winner: string, salt: number): string {
  if (condition === 'assassination') return format(pick(ASSASSINATION_WIN_LINES, salt), { winner });
  if (condition === 'glory') return format(pick(GLORY_WIN_LINES, salt), { winner });
  return `⏳ ${winner} outlasts. The cupboard is bare — game.`;
}
