import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { maySendWelcome } from './eligibility.ts';
Deno.test('a verified new signup can receive its one welcome', () => {
  assertEquals(maySendWelcome(true, 'pending'), true);
});
Deno.test('returning logins cannot resend a welcome', () => {
  assertEquals(maySendWelcome(true, 'sent'), false);
  assertEquals(maySendWelcome(true, 'sending'), false);
  assertEquals(maySendWelcome(true, undefined), false);
});
Deno.test('signup must be verified before welcome delivery', () => {
  assertEquals(maySendWelcome(false, 'pending'), false);
});