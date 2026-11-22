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
