// Cassius Vane — visceral fallback bank v2. Seeded by the few-shot in spec
// CritterFeature_Cassius_Vane_Voice_and_Live_Commentate_Spec.md (cowork 5d66cac6).
//
// Voice: 1950s drive-in creature-feature ringside announcer. Horrified and
// thrilled in the same breath. Biology IS the violence; biome IS the second
// killer. Campy gore, never genuinely disturbing, never mapped onto real people.
//
// Architecture: this static bank is the FALLBACK. The live commentate() call
// (lives in commentateClient.ts) is the primary source — this runs when the
// network is slow or down, or when the latency budget (~2.5s) expires before
// the live line arrives.

import type { GameEvent } from '../../../src/game/index.ts';

type StrikeResult = Extract<GameEvent, { t: 'strike-result' }>;
type StrikeReq = Extract<GameEvent, { t: 'strike' }>;

// ─────────────────────────────────────────────────────────────────
// BY-TAG BANKS — attacker's primary tag picks the murder weapon.
// ─────────────────────────────────────────────────────────────────

const VENOM_LINES = [
  "One strike. You barely saw it land. Now watch the {loser}'s legs stop — one, then the next, then all of them. The venom is reading it the last rites.",
  "The {winner} doesn't fight. It INJECTS. The {loser} is already a statue in {biome} and doesn't know it yet. HORRIBLE. Magnificent.",
  "A single sting, folks — and the {loser}'s nervous system gives up the lease. {winner} watches its dinner go still in {biome}.",
  "The {winner} doesn't need to land twice. The first one carried the whole pharmacy. Ladies and gentlemen, the {loser} is being SUBTRACTED.",
];

const ARMOR_LINES = [
  "The {winner} gets its jaws set and ROLLS. {biome} goes red to the waterline. Folks, I'm told the {loser} is in several pieces. SEVERAL.",
  "No finesse. No mercy. Just a ton of armor closing like a car door on the {loser}. Cassius needs a moment.",
  "The {winner} bites once and shakes once and that's the whole show. {biome} won't be the same after they hose it down.",
  "Plate vs. flesh — only ever ends one way. The {loser} hit it three times for nothing. The {winner} hit it once for everything.",
];

const AQUATIC_LINES = [
  "Down it goes — past the light, past the cold, to where the water itself is a fist. The {winner} barely bites. The dark of {biome} does the rest.",
  "Eight arms find every seam in the {loser} at once. Ladies and gentlemen, the {loser} is being UNFOLDED.",
  "The {winner} drags the {loser} into the deep of {biome} and the pressure finishes the sentence the bite started.",
  "It's a {biome}-fight now, folks — and {biome} only ever votes one way. The {loser} doesn't come back up.",
];

const FLYER_LINES = [
  "The {winner} folds its wings and drops out of {biome} like a thrown knife. The {loser} never hears it. Then it's just feathers and a sound I won't describe.",
  "Talons first at two hundred miles an hour. The {loser} comes apart in the air over {biome} before it lands. The CROWD is on its feet.",
  "Stoop, hit, GONE. The {winner} doesn't even slow down. The {loser} hits {biome} in three increasingly small pieces.",
  "From sun to throat in two seconds. {biome} watches the dive, and {biome} watches the rise. Only the {winner} comes back up.",
];

const MIND_LINES = [
  "The {winner} doesn't out-muscle the {loser} — it out-THINKS it. Knew where it'd flinch in {biome} before it flinched. Cold. Deliberate. Awful to watch.",
  "Watch the eyes, folks. The {winner} reads the {loser}'s next three moves and is already at move four. It's not a fight, it's a *prediction*.",
  "The {loser} brought every trick it had to {biome}. The {winner} brought ONE — knowing which trick was coming. End of show.",
  "Surgical. Premeditated. The {winner} performs the {loser} like a piece of paperwork. Ladies and gentlemen — the {loser} got *understood* to death.",
];

const MINDLESS_ENGULF_LINES = [
  "It doesn't kill the {loser}. It SURROUNDS it. And the part they'll talk about for weeks, folks — the {loser} is still moving in there.",
  "No brain, no plan, no mercy. The {winner} just flows over the {loser} in {biome} until there's only {winner}.",
  "The {winner} doesn't bite. It ABSORBS. The {loser} learns mid-swallow that the {winner} doesn't need a face to win.",
  "Slow. Soundless. Inexorable. The {biome} is now a {winner}-shape with a {loser}-shaped silhouette inside it.",
];

const UNBROKEN_LINES = [
  "The {winner} can't be killed and the {loser} finally understands that in {biome}. It throws everything. The {winner} simply... outlasts it. Endurance is its own kind of horror.",
  "You can't beat what won't end, folks. The {loser} swings until it stops swinging. The {winner} hasn't moved from where it was an hour ago.",
  "Three rounds in {biome} and the {winner} hasn't taken a meaningful hit. The {loser} is on its last reserves and the {winner} hasn't even started.",
  "Some monsters die. Some monsters don't. Today, in {biome}, the {loser} learned which one the {winner} is.",
];

// ─────────────────────────────────────────────────────────────────
// BY-EVENT BANKS — override tag flavor for these specific situations.
// ─────────────────────────────────────────────────────────────────

const TIE_BOUNCE = [
  "NOBODY dies! The {winner} and the {loser} hit at the exact same instant, recoil, and the {winner} staggers back to the bench. {biome} holds its breath.",
  "Bone meets bone. The {winner} and the {loser} both blink, neither blinks first, and the {winner} backs out of {biome} with the score even.",
  "Folks, that's the rarest thing on this card — a DRAW in {biome}. Both fighters walk it off. They will not be friends.",
];

const EMPTY_ARENA = [
  "The {winner} struts into an empty {biome} and plants the banner. No blood today, folks — just a flag and a very smug {winner}.",
  "Nobody home in {biome}. The {winner} signs the lease and moves the furniture in.",
  "Uncontested. The {winner} takes {biome} like it owed them money. Almost feels like cheating. ALMOST.",
];

const ACE_BURN = [
  "THAT WAS THE ACE. The {winner} just tore the mask off the {loser} — their hidden champion, dead in {biome}, and every secret they had spills out with it.",
  "The hidden one is hidden no more. THE ACE IS DEAD, folks. The {winner} hunted it through every smoke screen and burned it in {biome}.",
  "★ ASSASSINATION ON THE {biome}. ★ The {winner} found the secret weapon and snapped it in half. The crowd may need to sit down.",
];

const WINNER_NARROW = [
  "By a HAIR. The {loser} nearly had it in {biome} — but the {winner} drags itself up off the mat with the win and one less life in its eyes.",
  "Closest thing to a coin-flip {biome} has ever seen — and it landed {winner}. One more leg and it goes the other way. ONE.",
  "Folks, that one cost. The {winner} keeps the win in {biome} but bleeds two arenas for it. The {loser} dies, the {winner} limps.",
];

// Generic fallback when no tag and not narrow/tie/empty/ace-burn.
const WINNER_GENERIC = [
  "The {winner} dismantles the {loser} in {biome}. Old news by morning.",
  "Bad day for the {loser}. The {winner} took {biome} clean and didn't apologize.",
  "{biome} answered, folks — and the answer was {winner}. The {loser} is the answer to a different question now.",
  "The {winner} gives a master class in {biome}. The {loser} is the demonstration. Demonstrations are messy.",
];

// ─────────────────────────────────────────────────────────────────
// MATCH-END BANKS
// ─────────────────────────────────────────────────────────────────

const MATCH_END_GLORY = [
  "THREE ARENAS! It's over! {winner}'s banners fly over the board and the crowd has completely lost its mind!",
  "THAT'S THE BILL. {winner} holds the room — three arenas, one night, total control. Roll credits.",
  "The board belongs to {winner} now. {loser} is going home in the dark. Glory, folks. ABSOLUTE glory.",
];

const MATCH_END_ENDURANCE = [
  "They've got nothing left to send. No hand, no bench, no monsters. The {winner} wins by simply being the last thing standing.",
  "{loser} reached for a critter and found an empty cage. The water-bear taught us this one. Endurance wins. Always.",
  "The {loser} ran out of monsters before the {winner} ran out of patience. {biome} clears out. Nobody to bury.",
];

const MATCH_END_ASSASSINATION = [
  "THE ACE IS DEAD AND SO IS THE NIGHT! {winner} hunted the champion through {biome} and ended it. UNMASK IT. Show them what they killed!",
  "★ MAIN EVENT KILL ★ {winner} put the hidden one down in {biome}. {loser}'s champion is ash. That's how a Feature ends — grizzly, and on purpose.",
  "The hidden champion is dust on the {biome} floor. {winner} won by finding the one critter that mattered and breaking it. Folks. Go home. Tell your friends.",
];

// ─────────────────────────────────────────────────────────────────
// CLASSIFIER + RENDER
// ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], salt: number): T {
  return arr[Math.abs(salt) % arr.length]!;
}

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Tag-priority for picking which murder-weapon bank wins. Earlier in this list
// = takes precedence when an attacker has multiple. Tuned so the dominant flavor
// (Venom, Mindless engulf, etc.) outranks softer tags (Armor, Aquatic).
const TAG_PRIORITY: { tag: string; bank: string[] }[] = [
  { tag: 'Venom', bank: VENOM_LINES },
  { tag: 'Mindless', bank: MINDLESS_ENGULF_LINES },
  { tag: 'Unbroken', bank: UNBROKEN_LINES },
  { tag: 'Mind', bank: MIND_LINES },
  { tag: 'Flyer', bank: FLYER_LINES },
  { tag: 'Aquatic', bank: AQUATIC_LINES },
  { tag: 'Armor', bank: ARMOR_LINES },
];

function pickTagBank(attackerTags: readonly string[]): string[] | null {
  for (const { tag, bank } of TAG_PRIORITY) {
    if (attackerTags.includes(tag)) return bank;
  }
  return null;
}

export type CommentaryInput = {
  strikeReq: StrikeReq;
  strikeResult: StrikeResult;
  biome: string;
  attackerName: string;
  defenderName: string | null;
  attackerTags?: readonly string[];
};

export function strikeCommentary(input: CommentaryInput, salt: number): string {
  const { strikeResult, biome, attackerName, defenderName } = input;
  // Empty arena.
  if (defenderName === null) {
    return format(pick(EMPTY_ARENA, salt), { winner: attackerName, biome });
  }
  // Tie.
  if (strikeResult.winner === 'tie') {
    return format(pick(TIE_BOUNCE, salt), { winner: attackerName, loser: defenderName, biome });
  }
  const winner = strikeResult.winner === strikeResult.attacker ? attackerName : defenderName;
  const loser = strikeResult.winner === strikeResult.attacker ? defenderName : attackerName;
  // Ace-burn spectacle.
  if (strikeResult.aceBurned) {
    return format(pick(ACE_BURN, salt), { winner, loser, biome });
  }
  // Narrow (margin 1) — overrides tag flavor.
  const margin = Math.abs(strikeResult.aHits - strikeResult.bHits);
  if (margin === 1) {
    return format(pick(WINNER_NARROW, salt), { winner, loser, biome });
  }
  // Tag-driven (winner's tags pick the murder weapon).
  // For commentary, the WINNER's tags are what landed. If winner is the attacker,
  // use attacker tags from the event; if winner is the defender, we'd need
  // defender tags. Use the event's attackerTags as the primary source when the
  // attacker won; defenderTags when the defender won.
  const winnerIsAttacker = strikeResult.winner === strikeResult.attacker;
  const winnerTags = winnerIsAttacker ? strikeResult.attackerTags : (strikeResult.defenderTags ?? []);
  const tagBank = pickTagBank(winnerTags);
  if (tagBank) {
    return format(pick(tagBank, salt), { winner, loser, biome });
  }
  // Generic fallback (no signature tag).
  return format(pick(WINNER_GENERIC, salt), { winner, loser, biome });
}

export function winCommentary(
  condition: 'glory' | 'endurance' | 'assassination',
  winner: string,
  loser: string,
  salt: number,
  biome: string = 'the bill',
): string {
  let bank: string[];
  if (condition === 'glory') bank = MATCH_END_GLORY;
  else if (condition === 'endurance') bank = MATCH_END_ENDURANCE;
  else bank = MATCH_END_ASSASSINATION;
  return format(pick(bank, salt), { winner, loser, biome });
}
