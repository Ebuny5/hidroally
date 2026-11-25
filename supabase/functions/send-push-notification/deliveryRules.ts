export const REMINDER_LIMIT = 2;
export const CLIMATE_LIMIT = 6;
export const REMINDER_INTERVAL_MS = 8 * 60 * 60 * 1000;
export const CLIMATE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const isQuietHour = (hour: number) => hour >= 22 || hour < 6;
export const hasCoordinates = (latitude: unknown, longitude: unknown) => typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
export function climateCooldownBlocks(elapsed: number, previous: string, next: string): boolean {
  const ranks: Record<string, number> = { climate_moderate: 1, climate_high: 2, climate_extreme: 3 };
  return elapsed < CLIMATE_COOLDOWN_MS && (ranks[next] || 0) <= (ranks[previous] || 0);
}