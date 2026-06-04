import { STARTER_BY_NAME } from '../data/starter8.ts';
import { deriveCard } from '../engine/deriveCard.ts';
import { resolveBout } from '../engine/resolveBout.ts';
import { mulberry32 } from '../engine/rng.ts';
import { BIOMES, type Biome } from '../types.ts';

type Args = {
  a: string;
  b: string;
  biome?: Biome;
  legs?: number;
  seed: number;
};

function parseArgs(argv: string[]): Args {
  const cmd = argv[2];
  if (cmd !== 'bout') {
    console.error('Usage: critter-feature bout <A> <B> [--biome X] [--legs N] [--seed N]');
    process.exit(1);
  }
  const positional: string[] = [];
  let biome: Biome | undefined;
  let legs: number | undefined;
  let seed = 1;
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--biome') {
      const v = argv[++i];
      if (!v || !(BIOMES as readonly string[]).includes(v)) {
        console.error(`--biome must be one of: ${BIOMES.join(', ')}`);
        process.exit(1);
      }
      biome = v as Biome;
    } else if (a === '--legs') {
      legs = Number(argv[++i]);
    } else if (a === '--seed') {
      seed = Number(argv[++i]);
    } else {
      positional.push(a);
    }
  }
  if (positional.length < 2) {
    console.error('Need two creature names');
    process.exit(1);
  }
  const args: Args = { a: positional[0]!, b: positional[1]!, seed };
  if (biome !== undefined) args.biome = biome;
  if (legs !== undefined) args.legs = legs;
  return args;
}

function getCard(name: string) {
  const c = STARTER_BY_NAME.get(name);
  if (!c) {
    console.error(`Unknown creature "${name}". Starter 8: ${[...STARTER_BY_NAME.keys()].join(', ')}`);
    process.exit(1);
  }
  return deriveCard(c);
}

function main() {
  const args = parseArgs(process.argv);
  const aCard = getCard(args.a);
  const bCard = getCard(args.b);

  const rand = mulberry32(args.seed);

  console.log(`# ${aCard.creature.name} card: Might ${aCard.might} | Stamina ${aCard.stamina} | Home [${aCard.homeBiomes.join(', ') || '-'}] | Exposed [${aCard.exposedBiomes.join(', ') || '-'}] | Tags [${aCard.creature.tags.join(', ')}] | ${aCard.creature.ability.name}`);
  console.log(`# ${bCard.creature.name} card: Might ${bCard.might} | Stamina ${bCard.stamina} | Home [${bCard.homeBiomes.join(', ') || '-'}] | Exposed [${bCard.exposedBiomes.join(', ') || '-'}] | Tags [${bCard.creature.tags.join(', ')}] | ${bCard.creature.ability.name}`);

  const totalLegs = args.legs ?? 3;
  const biome = args.biome ?? 'Plains';
  const picks: Biome[] = totalLegs === 1 ? [biome] : [biome, biome, biome];

  const result = resolveBout({
    a: aCard,
    b: bCard,
    terrainPicks: picks,
    firstChallenger: 'a',
    legs: totalLegs,
    rand,
  });

  for (const line of result.log) console.log(line);
}

main();
