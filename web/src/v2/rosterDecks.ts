// Mint two DISJOINT decks from the full 130-creature roster. No shared names.
// Cowork e0a4beac: "Your critters vs their creatures" should be literally true.
//
// Each roster entry lacks tags + ability; we heuristic-mint them from class +
// archetype + the fearless_seed list. This is the v0.2-shim until generateCard
// (M2) replaces it with real AI-derived tags + ability per critter.

import roster from '../../../src/data/roster.json' with { type: 'json' };
import type { Creature, Tag, Ability } from '../../../src/types.ts';

type RosterEntry = {
  name: string;
  class: string;
  archetype?: string;
  affinity: Creature['affinity'];
  power_score: number | null;
  persona?: string | null;
};

const FEARLESS_SEED: string[] = (roster as { fearless_seed?: string[] }).fearless_seed ?? [];

// ──────────────────────────────────────────────────────────────────
// TAG DERIVATION
// ──────────────────────────────────────────────────────────────────

const TAG_BY_CLASS: Record<string, Tag[]> = {
  'Strength Kings': ['Armor'],
  'Birds & Flyers': ['Flyer'],
  'Intelligence': ['Mind'],
  'Marine': ['Aquatic'],
  'Extreme Survivors': ['Unbroken'],
  'Mammals': [],
  'Underrated Heroes': [],
  'Pound-for-Pound': ['Ambush'],
  'Hidden Gems': [],
  'Reptiles & Amphibians': [],
  'Bizarre & Weird': [],
  'Combo': [],
  'Humans': [],
};

const TAG_BY_ARCHETYPE: Record<string, Tag[]> = {
  'aerial_bird': ['Flyer'],
  'flying_small': ['Flyer'],
  'deep_sea': ['Aquatic'],
  'reef_coast_invert': ['Aquatic'],
  'open_ocean_fish': ['Aquatic'],
  'semi_aquatic_fresh': ['Aquatic'],
  'bug_terrestrial': ['Venom'],
  'desert_reptile': ['Venom'],
  'amphibian_wet': [],
  'arctic_land': ['Armor'],
  'big_cat_jungle': ['Ambush'],
  'savanna_megafauna': ['Armor'],
  'mountain_climber': [],
  'forest_small_mammal': [],
  'extremophile': ['Unbroken'],
  'human': [],
  'canid_grassland': [],
};

// Name-based overrides for known specials.
const TAG_BY_NAME: Record<string, Tag[]> = {
  'Tardigrade': ['Unbroken', 'Fearless'],
  'Slime Mold': ['Mindless', 'Collective', 'Regenerate'],
  'Octopus': ['Mind', 'Aquatic'],
  'Giant Octopus': ['Mind', 'Aquatic'],
  'Raven': ['Mind'],
  'African Grey': ['Mind'],
  'Chimpanzee': ['Mind'],
  'Chimp': ['Mind'],
  'Dolphin': ['Mind', 'Aquatic'],
  'Common Dolphin': ['Mind', 'Aquatic'],
  'AI': ['Mind', 'Fearless', 'Mindless'],
  'Earthworm': ['Fearless', 'Regenerate'],
  'Harp Sponge': ['Fearless', 'Aquatic'],
  'Immortal Jellyfish': ['Fearless', 'Regenerate', 'Aquatic'],
  'Siphonophore': ['Collective', 'Aquatic', 'Fearless'],
  'Termite': ['Collective', 'Fearless'],
  'Scorpion': ['Venom', 'Armor', 'Fearless'],
  'Inland Taipan': ['Venom'],
  'Box Jellyfish': ['Venom', 'Aquatic'],
  'Cone Snail': ['Venom', 'Aquatic'],
  'Jewel Wasp': ['Mind', 'Venom'],
  'Saltwater Crocodile': ['Aquatic', 'Armor'],
  'Snapping Turtle': ['Armor', 'Aquatic'],
  'Hippo': ['Armor', 'Aquatic'],
  'Polar Bear': ['Armor'],
  'Peregrine Falcon': ['Flyer'],
  'Eagle': ['Flyer'],
  'Goshawk': ['Flyer'],
  'Sea Otter': ['Menace'],
  'Jaguar': ['Ambush'],
  'Black Panther': ['Ambush'],
  'Leopard': ['Ambush'],
  'Giant Squid': ['Aquatic', 'Mind'],
  'Kraken': ['Aquatic'],
  'Orca': ['Aquatic', 'Mind'],
  'Great White Shark': ['Aquatic'],
  'Anaconda': ['Aquatic', 'Armor'],
};

function deriveTags(entry: RosterEntry): Tag[] {
  const out = new Set<Tag>();
  // Strongest: explicit name override.
  const nameTags = TAG_BY_NAME[entry.name];
  if (nameTags) nameTags.forEach((t) => out.add(t));
  // Then class.
  const classTags = TAG_BY_CLASS[entry.class] ?? [];
  classTags.forEach((t) => out.add(t));
  // Then archetype.
  const archTags = TAG_BY_ARCHETYPE[entry.archetype ?? ''] ?? [];
  archTags.forEach((t) => out.add(t));
  // Fearless seed list adds [Fearless].
  if (FEARLESS_SEED.includes(entry.name)) out.add('Fearless');
  return Array.from(out);
}

// ──────────────────────────────────────────────────────────────────
// ABILITY DERIVATION
// ──────────────────────────────────────────────────────────────────

function deriveAbility(entry: RosterEntry, tags: Tag[]): Ability {
  // Explicit name-based abilities for the starter 9 + Slime Mold (their hand-
  // statted abilities; everything else gets a tag-default).
  const STARTER_ABILITIES: Record<string, Ability> = {
    'Tardigrade':            { name: 'Cryptobiosis', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'StaminaTax', per: 'hit', n: 1 }], nullVs: [] },
    'Peregrine Falcon':      { name: 'Stoop', trigger: 'passive', cost: 0, biome: 'Sky', oncePerBout: false, effects: [{ verb: 'Reface', from: 6, to: 3 }], nullVs: [] },
    'Saltwater Crocodile':   { name: 'Death Roll', trigger: 'active', cost: 1, biome: 'Water', oncePerBout: false, effects: [{ verb: 'Reroll', scope: 'all' }], nullVs: [] },
    'Giant Squid':           { name: 'From the Dark', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'Reface', from: 3, to: 1 }], nullVs: [] },
    'Jaguar':                { name: 'Skull-Crush', trigger: 'passive', cost: 0, condition: 'isChallenger', oncePerBout: false, effects: [{ verb: 'ModifyDice', n: 2, target: 'self' }], nullVs: [] },
    'Sea Otter':             { name: 'Menace', trigger: 'active', cost: 1, oncePerBout: false, effects: [{ verb: 'ModifyDice', n: -2, target: 'opponent' }], nullVs: ['Fearless', 'Mind'] },
    'Scorpion':              { name: 'Sting & Shell', trigger: 'active', cost: 1, oncePerBout: true, effects: [{ verb: 'IgnoreHits', n: 1 }, { verb: 'DealAutoHit', n: 1 }], nullVs: [] },
    'Raven':                 { name: 'Foresight', trigger: 'active', cost: 0, oncePerBout: true, effects: [{ verb: 'Immune', tag: 'Menace' }, { verb: 'SwapBiome', target: 'neutral' }], nullVs: [] },
    'Slime Mold':            { name: 'Optimal Path', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'FightAsHome' }, { verb: 'FloorStamina', n: 1 }, { verb: 'CapHits', n: 1 }], nullVs: [] },
  };
  if (STARTER_ABILITIES[entry.name]) return STARTER_ABILITIES[entry.name]!;

  // Tag-default abilities. Picked to be flavorful + balanced for v0.2.
  if (tags.includes('Venom')) {
    return { name: 'Envenomate', trigger: 'active', cost: 1, oncePerBout: true, effects: [{ verb: 'DealAutoHit', n: 1 }, { verb: 'IgnoreHits', n: 1 }], nullVs: [] };
  }
  if (tags.includes('Mindless')) {
    return { name: 'Engulf', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'FightAsHome' }, { verb: 'CapHits', n: 1 }], nullVs: [] };
  }
  if (tags.includes('Unbroken')) {
    return { name: 'Endure', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'StaminaTax', per: 'hit', n: 1 }], nullVs: [] };
  }
  if (tags.includes('Mind')) {
    return { name: 'Read', trigger: 'active', cost: 0, oncePerBout: true, effects: [{ verb: 'Immune', tag: 'Menace' }], nullVs: [] };
  }
  if (tags.includes('Flyer')) {
    return { name: 'Stoop', trigger: 'passive', cost: 0, biome: 'Sky', oncePerBout: false, effects: [{ verb: 'Reface', from: 6, to: 3 }], nullVs: [] };
  }
  if (tags.includes('Aquatic')) {
    return { name: 'Pressure', trigger: 'active', cost: 1, biome: 'Water', oncePerBout: false, effects: [{ verb: 'Reroll', scope: 'all' }], nullVs: [] };
  }
  if (tags.includes('Armor')) {
    return { name: 'Shell', trigger: 'passive', cost: 0, oncePerBout: false, effects: [{ verb: 'IgnoreHits', n: 1 }], nullVs: [] };
  }
  if (tags.includes('Ambush')) {
    return { name: 'Surprise', trigger: 'passive', cost: 0, condition: 'isChallenger', oncePerBout: false, effects: [{ verb: 'ModifyDice', n: 2, target: 'self' }], nullVs: [] };
  }
  if (tags.includes('Menace')) {
    return { name: 'Menace', trigger: 'active', cost: 1, oncePerBout: false, effects: [{ verb: 'ModifyDice', n: -2, target: 'opponent' }], nullVs: ['Fearless', 'Mind'] };
  }
  // Generic untagged default — modest one-shot.
  return { name: 'Bite', trigger: 'active', cost: 1, oncePerBout: true, effects: [{ verb: 'DealAutoHit', n: 1 }], nullVs: [] };
}

// ──────────────────────────────────────────────────────────────────
// CREATURE MINTING — roster entry → playable Creature
// ──────────────────────────────────────────────────────────────────

export function rosterToCreature(entry: RosterEntry): Creature {
  const tags = deriveTags(entry);
  const ability = deriveAbility(entry, tags);
  const out: Creature = {
    name: entry.name,
    class: entry.class,
    affinity: entry.affinity,
    power_score: entry.power_score,
    tags,
    ability,
  };
  if (entry.archetype !== undefined) out.archetype = entry.archetype;
  if (entry.persona !== undefined) out.persona = entry.persona;
  return out;
}

// ──────────────────────────────────────────────────────────────────
// DISJOINT DECK PAIR
// ──────────────────────────────────────────────────────────────────

const POOL: Creature[] = (roster as { creatures: RosterEntry[] }).creatures
  .filter((e) => e.power_score !== null)  // exclude hand-statted nulls (Slime Mold for now)
  .map(rosterToCreature);

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function mintDeckPair(rand: () => number, perPlayer: number = 13): { p1Deck: Creature[]; p2Deck: Creature[] } {
  const shuffled = shuffle(POOL, rand);
  const p1Deck = shuffled.slice(0, perPlayer);
  const p2Deck = shuffled.slice(perPlayer, perPlayer * 2);
  return { p1Deck, p2Deck };
}

// Verification helper for tests + sanity.
export function decksDisjoint(p1: Creature[], p2: Creature[]): boolean {
  const p1Names = new Set(p1.map((c) => c.name));
  for (const c of p2) if (p1Names.has(c.name)) return false;
  return true;
}
