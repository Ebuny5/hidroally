import type { ReactNode } from 'react';
interface Props { icon: ReactNode; label: string; value: number | string; unit: string; colorClass: string; valueColor?: string }
export default function SensorDisplayCard({ icon, label, value, unit, colorClass, valueColor }: Props) {
  return <div className="bg-card text-card-foreground border border-border p-6 rounded-lg flex flex-col items-center justify-center text-center gap-3">
    <div className={colorClass}>{icon}</div>
    <p className="text-muted-foreground text-sm font-medium">{label}</p>
    <p className={`text-3xl font-bold ${valueColor || colorClass}`}>{typeof value === 'number' ? (unit === 'bpm' ? Math.round(value) : value.toFixed(2)) : value}<span className="text-base ml-2 font-normal">{unit}</span></p>
  </div>;
}
