import type { SensorReading } from './types';
export function assessSensor(reading: SensorReading) {
  if (reading.EDA_uS >= 10 || reading.HR_bpm >= 85) return {
    phase: 'Trigger' as const,
    explanation: 'EDA or heart rate is in the simulated Trigger range. Pause, cool down, and check how you feel.',
  };
  if (reading.EDA_uS >= 5 || reading.HR_bpm >= 72) return {
    phase: 'Active' as const,
    explanation: 'EDA or heart rate is elevated within this simulation. Monitor your comfort and any sweating symptoms.',
  };
  return { phase: 'Resting' as const, explanation: 'EDA and heart rate are within the simulated resting range.' };
}