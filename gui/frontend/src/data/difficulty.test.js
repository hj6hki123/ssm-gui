import { describe, expect, it } from 'vitest';
import { diffColor, diffIndex, diffLabel, diffName, diffStyleKey, isAppendColor } from './difficulty.js';

describe('difficulty', () => {
  it('names index 4 per game and falls back to expert', () => {
    expect(diffName('bang', 4)).toBe('special');
    expect(diffName('pjsk', 4)).toBe('master');
    expect(diffName('pjsk', 5)).toBe('append');
    expect(diffName('bang', 5)).toBe('expert');
    expect(diffLabel('pjsk', 4)).toBe('MASTER');
  });

  it('maps names from either game back to an index', () => {
    expect(diffIndex('EXPERT')).toBe(3);
    expect(diffIndex('special')).toBe(4);
    expect(diffIndex('master')).toBe(4);
    expect(diffIndex('append')).toBe(5);
    expect(diffIndex('unknown')).toBe(-1);
  });

  it('styles master like special', () => {
    expect(diffStyleKey('MASTER')).toBe('special');
    expect(diffColor('master')).toBe(diffColor('special'));
  });

  it('flags only append for the gradient look', () => {
    expect(isAppendColor(diffColor('append'))).toBe(true);
    expect(isAppendColor(diffColor('expert'))).toBe(false);
    expect(diffColor('nope')).toBe('#3b82f6');
  });
});
