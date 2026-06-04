import type { Biome } from '../../../src/types.ts';

type Props = {
  biomes: readonly Biome[];
  selected?: Biome | undefined;
  onSelect: (b: Biome) => void;
  disabled?: boolean;
};

const SHORT: Record<Biome, string> = {
  'Open Ocean': 'Ocean',
  'Deep Sea': 'Deep',
  'Ice/Arctic': 'Ice',
  Desert: 'Desert',
  Jungle: 'Jungle',
  Plains: 'Plains',
  Mountain: 'Mtn',
  Sky: 'Sky',
  'Wetland/Mud': 'Wet',
  Night: 'Night',
};

export function BiomeStrip({ biomes, selected, onSelect, disabled }: Props) {
  return (
    <div className="biome-strip">
      {biomes.map((b) => (
        <div
          key={b}
          className={`biome-cell ${selected === b ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && onSelect(b)}
          title={b}
        >
          {SHORT[b]}
        </div>
      ))}
    </div>
  );
}
