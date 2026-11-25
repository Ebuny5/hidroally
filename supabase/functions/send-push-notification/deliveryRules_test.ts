import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { REMINDER_LIMIT, CLIMATE_LIMIT, REMINDER_INTERVAL_MS, isQuietHour, hasCoordinates, climateCooldownBlocks } from './deliveryRules.ts';
Deno.test('check-ins allow at most two a day', () => assertEquals(REMINDER_LIMIT, 2));
Deno.test('climate allows at most six a day', () => assertEquals(CLIMATE_LIMIT, 6));
Deno.test('check-in interval is eight hours', () => assertEquals(REMINDER_INTERVAL_MS, 28800000));
Deno.test('quiet hours are 10 PM until 6 AM', () => {
  assertEquals(isQuietHour(22), true); assertEquals(isQuietHour(5), true);
  assertEquals(isQuietHour(6), false); assertEquals(isQuietHour(21), false);
});
Deno.test('two-hour climate cooldown permits severity escalation', () => {
  assertEquals(climateCooldownBlocks(7199999, 'climate_high', 'climate_high'), true);
  assertEquals(climateCooldownBlocks(7200000, 'climate_high', 'climate_high'), false);
  assertEquals(climateCooldownBlocks(1000, 'climate_moderate', 'climate_high'), false);
  assertEquals(climateCooldownBlocks(1000, 'climate_high', 'climate_extreme'), false);
});
Deno.test('zero longitude or latitude is a valid location', () => {
  assertEquals(hasCoordinates(0, 5), true); assertEquals(hasCoordinates(5, 0), true);
  assertEquals(hasCoordinates(null, 5), false); assertEquals(hasCoordinates(5, NaN), false);
});