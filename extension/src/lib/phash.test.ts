import { describe, expect, it } from 'vitest';
import { hammingDistance } from './phash';

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistance('a1b2c3d4e5f60789', 'a1b2c3d4e5f60789')).toBe(0);
  });

  it('returns 64 for malformed input (wrong length)', () => {
    expect(hammingDistance('short', 'a1b2c3d4e5f60789')).toBe(64);
    expect(hammingDistance('a1b2c3d4e5f60789', '')).toBe(64);
  });

  it('counts differing bits across two all-different hex digits', () => {
    // 0x0 = 0000, 0xf = 1111 -> 4 bits differ per digit pair
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('is symmetric', () => {
    const a = '0123456789abcdef';
    const b = 'fedcba9876543210';
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });

  it('detects a single-bit difference', () => {
    // 0x0 vs 0x1 differ by exactly 1 bit; rest identical
    expect(hammingDistance('0000000000000000', '1000000000000000')).toBe(1);
  });
});
