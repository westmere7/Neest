import { describe, expect, it } from 'vitest';
import { formatVnd } from './price';

describe('formatVnd', () => {
  it('uses Vietnamese thousands separators and the đồng sign', () => {
    expect(formatVnd({ vnd: 12990000, estimate: false })).toBe('12.990.000 ₫');
    expect(formatVnd({ vnd: 850000, estimate: false })).toBe('850.000 ₫');
    expect(formatVnd({ vnd: 65000, estimate: false })).toBe('65.000 ₫');
    expect(formatVnd({ vnd: 900, estimate: false })).toBe('900 ₫');
  });

  it('marks estimates as approximate', () => {
    expect(formatVnd({ vnd: 12500000, estimate: true })).toBe('≈ 12.500.000 ₫');
  });
});
