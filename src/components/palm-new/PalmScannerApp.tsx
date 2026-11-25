import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SensorReading, SimulationMode } from './types';
import SensorDisplayCard from './SensorDisplayCard';
import ModeInfo from './ModeInfo';
import StatusDisplay from './StatusDisplay';
import { assessSensor } from './sensorStatus';
import { ChevronLeft, Heart, Activity, Loader2 } from 'lucide-react';
import { MODE_DETAILS } from './constants';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { edaManager } from '@/utils/edaManager';
import { useEngagement } from '@/hooks/useEngagement';

export default function PalmScannerApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trackAction } = useEngagement();
  const requestedMode = searchParams.get('mode');
  const initialMode: SimulationMode = requestedMode === 'Active' || requestedMode === 'Trigger' ? requestedMode : 'Resting';
  const returnTo = searchParams.get('returnTo');
  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [loadingMode, setLoadingMode] = useState<SimulationMode | null>(initialMode);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { trackAction('wearable_simulator_uses'); }, [trackAction]);

  const fetchSensorData = useCallback(async (mode: SimulationMode) => {
    setLoadingMode(mode);
    setError(null);
    try {
      const { data, error: requestError } = await supabase.functions.invoke('generate-sensor-reading', { body: { mode } });
      if (requestError || !data || !Number.isFinite(data.EDA_uS) || !Number.isFinite(data.HR_bpm)) throw new Error('Sensor simulation is unavailable. Please try again.');
      const reading = data as SensorReading;
      const status = assessSensor(reading);
      setSensorData({ ...reading, notes: `${reading.notes} | Simulated ${status.phase}: ${status.explanation}` });
      edaManager.saveEDA(reading.EDA_uS, 'simulator');
      toast.success(`${mode} simulation generated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate this simulation.');
    } finally { setLoadingMode(null); }
  }, []);

  useEffect(() => { void fetchSensorData(initialMode); }, [initialMode, fetchSensorData]);
  useEffect(() => {
    if (!sensorData || !returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return;
    const timer = setTimeout(() => navigate(returnTo), 1500);
    return () => clearTimeout(timer);
  }, [sensorData, returnTo, navigate]);

  const currentMode = sensorData?.sim_mode || initialMode;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-6 sm:p-8 safe-area-bottom">
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        <header className="space-y-6">
          <Button variant="outline" size="icon" className="h-14 w-14" aria-label="Back to Home" onClick={() => navigate('/home')}><ChevronLeft /></Button>
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold">Giftovate Band</h1>
            <p className="text-muted-foreground">Wearable Sensor Simulator · Prototype</p>
          </div>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" aria-label="Simulation phases">
          {(Object.keys(MODE_DETAILS) as SimulationMode[]).map(mode => (
            <Button key={mode} variant="outline" className={`h-14 text-base ${MODE_DETAILS[mode].buttonColor}`} aria-pressed={currentMode === mode} disabled={loadingMode !== null} onClick={() => void fetchSensorData(mode)}>
              {loadingMode === mode ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Activity />}
              Simulate {mode}
            </Button>
          ))}
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {sensorData ? <>
          <StatusDisplay reading={sensorData} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SensorDisplayCard icon={<Heart className="h-10 w-10" />} label="Heart Rate" value={sensorData.HR_bpm} unit="bpm" colorClass={MODE_DETAILS[currentMode].textColor} />
            <SensorDisplayCard icon={<Activity className="h-10 w-10" />} label="Electrodermal Activity" value={sensorData.EDA_uS} unit="μS" colorClass={MODE_DETAILS[currentMode].textColor} />
          </div>
          <p className="text-sm text-muted-foreground">{new Date(sensorData.timestamp).toLocaleString()} · Simulated reading</p>
        </> : <div role="status" className="flex items-center justify-center gap-3 py-10"><Loader2 className="animate-spin motion-reduce:animate-none" />{loadingMode ? 'Simulating sensor readings…' : 'No reading yet'}</div>}
        <ModeInfo />
        <p className="text-sm text-muted-foreground">Simulation only—not a live band reading or a diagnosis. The Giftovate Band is in prototype development.</p>
      </div>
    </div>
  );
}
