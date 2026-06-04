import { z } from 'zod';

export const BIOMES = [
  'Open Ocean',
  'Deep Sea',
  'Ice/Arctic',
  'Desert',
  'Jungle',
  'Plains',
  'Mountain',
  'Sky',
  'Wetland/Mud',
  'Night',
] as const;

export type Biome = (typeof BIOMES)[number];

export const BiomeSchema = z.enum(BIOMES);

export const TAGS = [
  'Fearless',
  'Unbroken',
  'Aquatic',
  'Flyer',
  'Venom',
  'Armor',
  'Mind',
  'Ambush',
  'Menace',
  'Collective',
  'Mindless',
  'Regenerate',
] as const;

export type Tag = (typeof TAGS)[number];

export const EffectSchema = z.discriminatedUnion('verb', [
  z.object({ verb: z.literal('ModifyDice'), n: z.number(), target: z.enum(['self', 'opponent']).default('self') }),
  z.object({ verb: z.literal('Reroll'), scope: z.union([z.literal('all'), z.number()]) }),
  z.object({ verb: z.literal('Reface'), from: z.number().int().min(1).max(6), to: z.number().int().min(0) }),
  z.object({ verb: z.literal('IgnoreHits'), n: z.number().int().nonnegative() }),
  z.object({ verb: z.literal('DealAutoHit'), n: z.number().int().nonnegative() }),
  z.object({ verb: z.literal('StaminaTax'), per: z.literal('hit'), n: z.number() }),
  z.object({ verb: z.literal('DrainStamina'), n: z.number() }),
  z.object({ verb: z.literal('FightAsHome') }),
  z.object({ verb: z.literal('CapHits'), n: z.number().int().nonnegative() }),
  z.object({ verb: z.literal('FloorStamina'), n: z.number().int().nonnegative() }),
  z.object({ verb: z.literal('SwapBiome'), target: z.enum(['neutral', 'any']) }),
  z.object({ verb: z.literal('CopyForm') }),
  z.object({ verb: z.literal('Immune'), tag: z.enum(TAGS) }),
]);

export type Effect = z.infer<typeof EffectSchema>;

export const AbilitySchema = z.object({
  name: z.string(),
  trigger: z.enum(['passive', 'active']),
  cost: z.number().int().nonnegative().default(0),
  biome: z.union([BiomeSchema, z.enum(['Water'])]).optional(),
  condition: z.enum(['isChallenger']).optional(),
  oncePerBout: z.boolean().default(false),
  effects: z.array(EffectSchema),
  nullVs: z.array(z.enum(TAGS)).default([]),
  flavor: z.string().optional(),
});

export type Ability = z.infer<typeof AbilitySchema>;

export const AffinityVectorSchema = z.object({
  'Open Ocean': z.number(),
  'Deep Sea': z.number(),
  'Ice/Arctic': z.number(),
  Desert: z.number(),
  Jungle: z.number(),
  Plains: z.number(),
  Mountain: z.number(),
  Sky: z.number(),
  'Wetland/Mud': z.number(),
  Night: z.number(),
});

export type AffinityVector = z.infer<typeof AffinityVectorSchema>;

export const CreatureSchema = z.object({
  name: z.string(),
  class: z.string(),
  archetype: z.string().optional(),
  affinity: AffinityVectorSchema,
  power_score: z.number().nullable(),
  tags: z.array(z.enum(TAGS)),
  ability: AbilitySchema,
  persona: z.string().nullable().optional(),
  flavor: z.string().optional(),
  mightOverride: z.number().int().min(1).optional(),
  staminaOverride: z.number().int().min(1).optional(),
});

export type Creature = z.infer<typeof CreatureSchema>;

export type Card = {
  creature: Creature;
  might: number;
  stamina: number;
  homeBiomes: Biome[];
  exposedBiomes: Biome[];
};

export type TerrainMod = {
  diceDelta: number;
  reroll: boolean;
  abilityOn: boolean;
  classification: 'home' | 'exposed' | 'neutral';
};

export type StrikeRoll = {
  diceRolled: number[];
  rerolled?: number[];
  hits: number;
  reaceNotes?: string[];
};

export type LegResult = {
  biome: Biome;
  challenger: string;
  aHits: number;
  bHits: number;
  winner: string | null;
  aStaminaDelta: number;
  bStaminaDelta: number;
  log: string[];
};

export type BoutResult = {
  a: string;
  b: string;
  legs: LegResult[];
  winner: string;
  winType: 'glory' | 'endurance';
  aFinalStamina: number;
  bFinalStamina: number;
  log: string[];
};
