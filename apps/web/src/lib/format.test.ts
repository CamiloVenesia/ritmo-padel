import { describe, expect, it } from 'vitest';
import { displayDate, money, toMinutes } from './format';

describe('UI formatters', () => {
  it('converts time to comparable minutes', () => expect(toMinutes('18:30')).toBe(1110));
  it('displays Argentine pesos', () => expect(money(2800000)).toContain('28.000'));
  it('displays dates in Spanish', () => expect(displayDate('2026-10-22')).toContain('22'));
});
