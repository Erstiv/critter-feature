import { describe, expect, it } from 'vitest';
import { deriveCard } from '../src/engine/deriveCard.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import { resolveBout } from '../src/engine/resolveBout.ts';
import { STARTER_BY_NAME } from '../src/data/starter8.ts';

const card = (name: string) => deriveCard(STARTER_BY_NAME.get(name)!);

describe('deriveCard — paper-card anchors', () => {
  it('Tardigrade prints 2/9 with flat profile (no Home, no Exposed) under [Unbroken]', () => {
    const c = card('Tardigrade');
    expect(c.might).toBe(2);
    expect(c.stamina).toBe(9);
    expect(c.homeBiomes).toEqual([]);
    expect(c.exposedBiomes).toEqual([]);
  });

  it('Peregrine Falcon prints 4/4 with Home=[Sky]', () => {
    const c = card('Peregrine Falcon');
    expect(c.might).toBe(4);
    expect(c.stamina).toBe(4);
    expect(c.homeBiomes).toContain('Sky');
  });

  it('Raven prints 3/6 with Sky as Home', () => {
    const c = card('Raven');
    expect(c.might).toBe(3);
    expect(c.stamina).toBe(6);
    expect(c.homeBiomes).toContain('Sky');
  });

  it('Saltwater Crocodile prints 4/6 with Wetland/Mud Home', () => {
    const c = card('Saltwater Crocodile');
    expect(c.might).toBe(4);
    expect(c.stamina).toBe(6);
    expect(c.homeBiomes).toContain('Wetland/Mud');
  });
});

describe('resolveBout — signature dynamics', () => {
  it('Tardigrade wins Peregrine on Plains via Endurance (Cryptobiosis drain)', () => {
    const result = resolveBout({
      a: card('Tardigrade'),
      b: card('Peregrine Falcon'),
      terrainPicks: ['Plains', 'Plains', 'Plains'],
      firstChallenger: 'a',
      rand: mulberry32(99),
    });
    expect(result.winner).toBe('Tardigrade');
    expect(result.winType).toBe('endurance');
  });

  it('Sea Otter Menace is NULLIFIED against [Fearless] Tardigrade', () => {
    const result = resolveBout({
      a: card('Sea Otter'),
      b: card('Tardigrade'),
      terrainPicks: ['Wetland/Mud'],
      firstChallenger: 'a',
      legs: 1,
      rand: mulberry32(3),
    });
    const legLog = result.legs[0]!.log.join('\n');
    expect(legLog).toMatch(/Menace.*NULLIFIED.*Tardigrade carries \[Fearless\]/);
  });

  it('Stoop fires in Sky and refaces 6s', () => {
    const result = resolveBout({
      a: card('Peregrine Falcon'),
      b: card('Saltwater Crocodile'),
      terrainPicks: ['Sky'],
      firstChallenger: 'a',
      legs: 1,
      rand: mulberry32(7),
    });
    const legLog = result.legs[0]!.log.join('\n');
    expect(legLog).toMatch(/Stoop.*fires/);
    expect(legLog).toMatch(/Saltwater Crocodile.*EXPOSED/);
  });

  it('Salty Croc beats Sea Otter in Wetland/Mud by Glory', () => {
    const result = resolveBout({
      a: card('Saltwater Crocodile'),
      b: card('Sea Otter'),
      terrainPicks: ['Wetland/Mud', 'Wetland/Mud', 'Wetland/Mud'],
      firstChallenger: 'a',
      rand: mulberry32(42),
    });
    expect(result.winner).toBe('Saltwater Crocodile');
    expect(result.winType).toBe('glory');
  });
});
