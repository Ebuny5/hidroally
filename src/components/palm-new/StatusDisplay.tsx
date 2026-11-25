import type { SensorReading } from './types';
import { assessSensor } from './sensorStatus';
import { MODE_DETAILS } from './constants';

export default function StatusDisplay({ reading }: { reading: SensorReading }) {
  const { phase, explanation } = assessSensor(reading);
  return <section aria-live="polite" className="border-y border-border py-6 space-y-3">
    <h2 className={`text-xl font-semibold ${MODE_DETAILS[phase].textColor}`}>{phase} Range</h2>
    <p className="text-foreground">{explanation}</p>
  </section>;
}
