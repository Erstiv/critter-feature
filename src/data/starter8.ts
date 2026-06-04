import type { Creature } from '../types.ts';
import roster from './roster.json' with { type: 'json' };

type RosterEntry = {
  name: string;
  class: string;
  archetype?: string;
  affinity: Creature['affinity'];
  power_score: number | null;
  persona?: string | null;
};

const rosterByName = new Map<string, RosterEntry>(
  (roster.creatures as RosterEntry[]).map((c) => [c.name, c])
);

function fromRoster(name: string): Pick<Creature, 'name' | 'class' | 'archetype' | 'affinity' | 'power_score' | 'persona'> {
  const r = rosterByName.get(name);
  if (!r) throw new Error(`Roster missing ${name}`);
  return {
    name: r.name,
    class: r.class,
    archetype: r.archetype,
    affinity: r.affinity,
    power_score: r.power_score,
    persona: r.persona ?? null,
  };
}

export const STARTER_8: Creature[] = [
  {
    ...fromRoster('Tardigrade'),
    tags: ['Unbroken', 'Fearless'],
    mightOverride: 2,
    staminaOverride: 9,
    flavor: 'You can\'t beat what you can\'t put away — you can only run out of time first.',
    ability: {
      name: 'Cryptobiosis',
      trigger: 'passive',
      cost: 0,
      oncePerBout: false,
      effects: [{ verb: 'StaminaTax', per: 'hit', n: 1 }],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Peregrine Falcon'),
    tags: ['Flyer'],
    mightOverride: 4,
    staminaOverride: 4,
    flavor: 'Fastest thing alive — in the one place it\'s fast.',
    ability: {
      name: 'Stoop',
      trigger: 'passive',
      cost: 0,
      biome: 'Sky',
      oncePerBout: false,
      effects: [{ verb: 'Reface', from: 6, to: 3 }],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Saltwater Crocodile'),
    tags: ['Aquatic', 'Armor'],
    mightOverride: 4,
    staminaOverride: 6,
    flavor: 'Drag anything into the water and it stops being a fair fight.',
    ability: {
      name: 'Death Roll',
      trigger: 'active',
      cost: 1,
      biome: 'Water',
      oncePerBout: false,
      effects: [{ verb: 'Reroll', scope: 'all' }],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Giant Squid'),
    tags: ['Aquatic'],
    mightOverride: 4,
    staminaOverride: 5,
    flavor: 'The deep has its own monster, and it never comes up for you.',
    ability: {
      name: 'From the Dark',
      trigger: 'passive',
      cost: 0,
      oncePerBout: false,
      effects: [{ verb: 'Reface', from: 3, to: 1 }],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Jaguar'),
    tags: ['Ambush'],
    mightOverride: 4,
    staminaOverride: 5,
    flavor: 'Hardest bite per pound — and it picks the room.',
    ability: {
      name: 'Skull-Crush',
      trigger: 'passive',
      cost: 0,
      condition: 'isChallenger',
      oncePerBout: false,
      effects: [{ verb: 'ModifyDice', n: 2, target: 'self' }],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Sea Otter'),
    tags: ['Menace'],
    mightOverride: 3,
    staminaOverride: 5,
    flavor: 'Don\'t read the rest of its file. The terror only works if you can be scared.',
    ability: {
      name: 'Menace',
      trigger: 'active',
      cost: 1,
      oncePerBout: false,
      effects: [{ verb: 'ModifyDice', n: -2, target: 'opponent' }],
      nullVs: ['Fearless', 'Mind'],
    },
  },
  {
    ...fromRoster('Scorpion'),
    tags: ['Venom', 'Armor', 'Fearless'],
    mightOverride: 3,
    staminaOverride: 7,
    flavor: 'A mini water-bear that came armed.',
    ability: {
      name: 'Sting & Shell',
      trigger: 'active',
      cost: 1,
      oncePerBout: true,
      effects: [
        { verb: 'IgnoreHits', n: 1 },
        { verb: 'DealAutoHit', n: 1 },
      ],
      nullVs: [],
    },
  },
  {
    ...fromRoster('Raven'),
    tags: ['Mind'],
    mightOverride: 3,
    staminaOverride: 6,
    flavor: 'You can\'t spook the thing that reads the trick — it just counts the wings.',
    ability: {
      name: 'Foresight',
      trigger: 'active',
      cost: 0,
      oncePerBout: true,
      effects: [
        { verb: 'Immune', tag: 'Menace' },
        { verb: 'SwapBiome', target: 'neutral' },
      ],
      nullVs: [],
    },
  },
];

// Slime Mold (`adjudicate` fixture per cowork memo 73cbc6d4): hand-statted at
// Might 1 · Stamina 9. Demonstrates [Mindless] bypass of Exposed + Optimal Path
// (FightAsHome + FloorStamina + CapHits). Available via CLI as a 9th playable.
export const SLIME_MOLD: Creature = {
  ...fromRoster('Slime Mold'),
  tags: ['Collective', 'Mindless', 'Regenerate'],
  mightOverride: 1,
  staminaOverride: 9,
  // Cowork-prescribed printed Home/Exposed (memo 73cbc6d4). Roster JSON puts
  // Night at affinity 7, which would NOT qualify as Home under strict aff≥8 —
  // hence the explicit override.
  homeOverride: ['Wetland/Mud', 'Jungle', 'Night'],
  exposedOverride: ['Desert', 'Ice/Arctic', 'Sky', 'Open Ocean'],
  flavor: 'Brainless yet solves mazes — fights you to a 1-1 tie until you give up.',
  ability: {
    name: 'Optimal Path',
    trigger: 'passive',
    cost: 0,
    oncePerBout: false,
    effects: [
      { verb: 'FightAsHome' },
      { verb: 'FloorStamina', n: 1 },
      { verb: 'CapHits', n: 1 },
    ],
    nullVs: [],
  },
};

export const STARTER_8_PLUS = [...STARTER_8, SLIME_MOLD];

export const STARTER_BY_NAME = new Map(STARTER_8_PLUS.map((c) => [c.name, c]));
