import { describe, it, expect } from 'vitest';
import { snapToTileUnit, TILE_UNIT_HEIGHT } from '@/lib/constants';

describe('snapToTileUnit', () => {
  it('leaves exact multiples untouched', () => {
    expect(snapToTileUnit(80)).toBe(80);
    expect(snapToTileUnit(400)).toBe(400);
  });

  it('rounds up to the next whole unit', () => {
    expect(snapToTileUnit(81)).toBe(160);
    expect(snapToTileUnit(417)).toBe(480);
  });

  it('rounds up sub-pixel measurements', () => {
    expect(snapToTileUnit(400.5)).toBe(480);
  });

  it('always lands on a multiple of the unit height', () => {
    for (const h of [1, 37, 99, 250, 640.25, 1013]) {
      expect(snapToTileUnit(h) % TILE_UNIT_HEIGHT).toBe(0);
    }
  });

  it('never returns less than the measured height', () => {
    for (const h of [1, 37, 99, 250, 640.25, 1013]) {
      expect(snapToTileUnit(h)).toBeGreaterThanOrEqual(h);
    }
  });

  it('handles degenerate measurements', () => {
    expect(snapToTileUnit(0)).toBe(0);
    expect(snapToTileUnit(-5)).toBe(0);
    expect(snapToTileUnit(NaN)).toBe(0);
  });
});
