import { describe, it, expect } from 'bun:test';
import { calculateSweatRiskV2 } from './sweatRiskCalculator';

describe('humid evaporative block', () => {
  it('25°C with 95% humidity is Moderate, not Low', () => {
    expect(calculateSweatRiskV2({ temperature: 25, humidity: 95, uvIndex: 0 }).level).toBe('moderate');
  });
  it('22°C with 95% humidity stays Low', () => {
    expect(calculateSweatRiskV2({ temperature: 22, humidity: 95, uvIndex: 0 }).level).toBe('low');
  });
});

describe('climate reason matches real driver', () => {
  it('35.1°C at 34% humidity blames heat, not humidity', () => {
    const d = calculateSweatRiskV2({ temperature: 35.1, humidity: 34, uvIndex: 4 }).description;
    expect(d).toContain('High temperature');
    expect(d).not.toContain('high humidity');
  });
});
