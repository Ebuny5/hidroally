import { MODE_DETAILS } from './constants';
import type { SimulationMode } from './types';
export default function ModeInfo() {
  return <section className="space-y-6">
    <h2 className="text-lg font-semibold">Simulation Parameters</h2>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {(Object.keys(MODE_DETAILS) as SimulationMode[]).map(mode => <div key={mode} className="space-y-3">
        <h3 className={`font-semibold ${MODE_DETAILS[mode].textColor}`}>{mode}</h3>
        <ul className="text-sm text-muted-foreground space-y-2">{MODE_DETAILS[mode].ranges.map(range => <li key={range}>{range}</li>)}</ul>
      </div>)}
    </div>
  </section>;
}
