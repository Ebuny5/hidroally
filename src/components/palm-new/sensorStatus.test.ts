import { it, expect } from 'bun:test';
import { assessSensor } from './sensorStatus';
import type { SensorReading } from './types';
const reading = (EDA_uS: number, HR_bpm: number): SensorReading => ({ EDA_uS, HR_bpm, sim_mode: 'Resting', user_id: 'synthetic', timestamp: '', EDA_baseline_uS: 3, HR_baseline_bpm: 65, notes: '' });
it('Resting phase remains available without a photograph', () => expect(assessSensor(reading(3, 65)).phase).toBe('Resting'));
it('Active phase remains available without a photograph', () => expect(assessSensor(reading(7, 78)).phase).toBe('Active'));
it('Trigger phase remains available without a photograph', () => expect(assessSensor(reading(12, 95)).phase).toBe('Trigger'));
it('heart-rate elevation is assessed without camera input', () => expect(assessSensor(reading(3, 95)).phase).toBe('Trigger'));