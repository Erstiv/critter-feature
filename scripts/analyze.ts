// Curve-fit + cardCost analysis for the M0 sign-off memos.
//   $ npx tsx scripts/analyze.ts
import roster from '../src/data/roster.json' with { type: 'json' };
import { STARTER_8_PLUS } from '../src/data/starter8.ts';
import type { Tag } from '../src/types.ts';

type RosterC = {
  name: string;
  class: string;
  affinity: Record<string, number>;
  power_score: number | null;
};

const creatures = (roster.creatures as RosterC[]).filter((c) => c.power_score !== null);

// ---- POWER-SCORE QUINTILES ----
const sortedPS = creatures.map((c) => c.power_score as number).sort((a, b) => a - b);
const q = [0.2, 0.4, 0.6, 0.8].map((p) => sortedPS[Math.floor(sortedPS.length * p)]!);
console.log('=== POWER SCORE QUINTILES (n=129) ===');
console.log(`q1 ≤ ${q[0]} | q2 ≤ ${q[1]} | q3 ≤ ${q[2]} | q4 ≤ ${q[3]} | q5 > ${q[3]}`);

function quintile(power: number): 1 | 2 | 3 | 4 | 5 {
  if (power <= q[0]!) return 1;
  if (power <= q[1]!) return 2;
  if (power <= q[2]!) return 3;
  if (power <= q[3]!) return 4;
  return 5;
}

// ---- PROPOSED MIGHT CURVE ----
// q1→2 q2→3 q3→3 q4→3 q5→4
// Tag mods: [Unbroken] -1, [Mindless] -1, [Mind] -1, [Ambush] +1
// Clamp to [1, 4].
const MIGHT_FROM_QUINTILE: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 2, 2: 3, 3: 3, 4: 3, 5: 4 };
function tagMightMod(tags: Tag[]): number {
  let m = 0;
  if (tags.includes('Unbroken')) m -= 1;
  if (tags.includes('Mindless')) m -= 1;
  if (tags.includes('Mind')) m -= 1;
  if (tags.includes('Ambush')) m += 1;
  return m;
}
function deriveMight(power: number | null, tags: Tag[]): number {
  const base = power === null ? 2 : MIGHT_FROM_QUINTILE[quintile(power)]!;
  return Math.max(1, Math.min(4, base + tagMightMod(tags)));
}

// ---- PROPOSED STAMINA CURVE ----
// base = 9 - might
// mods: [Unbroken]/[Regenerate] +2, [Armor] +1, [Flyer] -1
// clamp to [1, ∞]
function tagStamMod(tags: Tag[]): number {
  let s = 0;
  if (tags.includes('Unbroken') || tags.includes('Regenerate')) s += 2;
  if (tags.includes('Armor')) s += 1;
  if (tags.includes('Flyer')) s -= 1;
  return s;
}
function deriveStamina(might: number, tags: Tag[]): number {
  return Math.max(1, 9 - might + tagStamMod(tags));
}

// ---- ANCHOR VALIDATION ----
console.log('\n=== ANCHOR FIT vs PRINTED CARD ===');
const anchors = STARTER_8_PLUS.map((c) => ({
  name: c.name,
  tags: c.tags,
  power: c.power_score,
  printedMight: c.mightOverride!,
  printedStam: c.staminaOverride!,
}));
for (const a of anchors) {
  const curveMight = deriveMight(a.power, a.tags);
  const curveStam = deriveStamina(curveMight, a.tags);
  const mightOK = curveMight === a.printedMight;
  const stamOK = curveStam === a.printedStam;
  console.log(
    `  ${a.name.padEnd(22)} power=${(a.power ?? -1).toString().padStart(6)}  ` +
      `curve ${curveMight}/${curveStam}  printed ${a.printedMight}/${a.printedStam}  ` +
      `${mightOK && stamOK ? '✅' : mightOK ? '⚠ stam' : stamOK ? '⚠ might' : '✗ both'}`
  );
}

// ---- AFFINITY BREADTH ----
const BIOMES = ['Open Ocean', 'Deep Sea', 'Ice/Arctic', 'Desert', 'Jungle', 'Plains', 'Mountain', 'Sky', 'Wetland/Mud', 'Night'] as const;
function affinityBreadth(aff: Record<string, number>): number {
  // breadth = count of biomes with aff ≥ 5 (decent presence), normalized to 0..1
  let n = 0;
  for (const b of BIOMES) if ((aff[b] ?? 0) >= 5) n += 1;
  return n / BIOMES.length;
}

// ---- ABILITY STRENGTH PROXY ----
// Simple scoring by effect verb: passive +0.5, active +1.0; verb weights below.
const VERB_W: Record<string, number> = {
  ModifyDice: 0.6,
  Reroll: 0.5,
  Reface: 0.5,
  IgnoreHits: 0.7,
  DealAutoHit: 0.8,
  StaminaTax: 0.9,
  DrainStamina: 0.7,
  FightAsHome: 1.0,
  CapHits: -0.5, // self-imposed cap → reduces strength
  FloorStamina: 0.6,
  SwapBiome: 0.5,
  CopyForm: 1.0,
  Immune: 0.4,
};
type AbProxy = { verbs: { verb: string }[]; trigger: 'passive' | 'active'; nullVs?: string[] };
function abilityStrength(ab: AbProxy): number {
  let s = ab.trigger === 'active' ? 1.0 : 0.5;
  for (const e of ab.verbs) s += VERB_W[e.verb] ?? 0.3;
  if (ab.nullVs && ab.nullVs.length > 0) s -= 0.15 * ab.nullVs.length; // null clauses reduce raw power
  return Math.max(0, s);
}

// ---- cardCost FORMULA ----
// cost = (0.45·might_n + 0.25·stam_n + 0.15·affBreadth_n + 0.15·abilityStrength_n) * 100
// might_n = (might - 1) / 3      (range 1..4 → 0..1)
// stam_n  = (stam - 1) / 11      (range 1..12 → 0..1)
// affBreadth_n already 0..1
// abilityStrength_n  = clamp(abStr / 3.5, 0, 1)
function cardCost(might: number, stam: number, affB: number, abStr: number): number {
  // Cowork ratification b8ea916c: Option B scale — `cost = 50 + (sum)*100`.
  // 100 = average. Soft review-flag bands [75..85, 120..135]; hard clamp <75 or >135.
  const mN = (might - 1) / 3;
  const sN = Math.min(1, (stam - 1) / 11);
  const aN = affB;
  const xN = Math.min(1, abStr / 3.5);
  return Math.round(50 + (0.45 * mN + 0.25 * sN + 0.15 * aN + 0.15 * xN) * 100);
}

console.log('\n=== STARTER 9 cardCost (Option B; clean 85–120, flag 75–85/120–135, clamp <75 or >135) ===');
for (const c of STARTER_8_PLUS) {
  const m = c.mightOverride!;
  const s = c.staminaOverride!;
  const affB = affinityBreadth(c.affinity);
  const xStr = abilityStrength({
    verbs: c.ability.effects.map((e) => ({ verb: e.verb })),
    trigger: c.ability.trigger,
    nullVs: c.ability.nullVs,
  });
  const cost = cardCost(m, s, affB, xStr);
  const verdict =
    cost >= 85 && cost <= 120 ? '✅ clean'
    : cost >= 75 && cost < 85 ? '⚠ flag (low)'
    : cost > 120 && cost <= 135 ? '⚠ flag (high)'
    : cost < 75 ? '✗ clamp (low)'
    : '✗ clamp (high)';
  console.log(
    `  ${c.name.padEnd(22)} M${m}/S${s}  affB=${affB.toFixed(2)}  abStr=${xStr.toFixed(2)}  cost=${cost}  ${verdict}`
  );
}

console.log('\n=== ROSTER cardCost DISTRIBUTION (might/stam from curve, no abilities) ===');
const costs: number[] = [];
const outliers: { name: string; cost: number }[] = [];
for (const c of creatures) {
  const tags: Tag[] = []; // long tail has no tags yet
  const m = deriveMight(c.power_score, tags);
  const s = deriveStamina(m, tags);
  const affB = affinityBreadth(c.affinity);
  // baseline abilityStrength for unknown ability: assume passive single-effect = 0.8
  const xStr = 0.8;
  const cost = cardCost(m, s, affB, xStr);
  costs.push(cost);
  if (cost < 92 || cost > 108) outliers.push({ name: c.name, cost });
}
costs.sort((a, b) => a - b);
console.log(`  N=${costs.length}  min=${costs[0]}  max=${costs[costs.length - 1]}  median=${costs[Math.floor(costs.length / 2)]}`);
console.log(`  clean [85..120]: ${costs.filter((c) => c >= 85 && c <= 120).length}/${costs.length}`);
console.log(`  flagged [75..85, 120..135]: ${costs.filter((c) => (c >= 75 && c < 85) || (c > 120 && c <= 135)).length}/${costs.length}`);
console.log(`  hard-clamp (<75 or >135): ${costs.filter((c) => c < 75 || c > 135).length}/${costs.length}`);

// Hist
const bins: Record<string, number> = {};
for (const c of costs) {
  const bucket = Math.floor(c / 5) * 5;
  bins[bucket] = (bins[bucket] || 0) + 1;
}
console.log('\n  histogram (5-pt bins):');
for (const k of Object.keys(bins).sort((a, b) => Number(a) - Number(b))) {
  console.log(`    ${k.padStart(3)} ${'█'.repeat(bins[k]!)} (${bins[k]})`);
}
