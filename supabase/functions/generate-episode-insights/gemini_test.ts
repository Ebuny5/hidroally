import { buildGeminiRequest, EPISODE_MODEL, readGeminiText } from './gemini.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('episode generation uses the approved Gemini 2.5 Flash model', () => {
  assert(EPISODE_MODEL === 'gemini-2.5-flash', 'Wrong episode model');
});

Deno.test('Gemini request preserves custom areas, all triggers, notes, history and knowledge', () => {
  const prompt = 'Areas: Trunk/Full Torso, behind knees. Triggers: Blood Pressure Medication, Dancing, Anxiety. Notes: network outage, not work pressure. History: 104 records. Knowledge: discuss medication with prescribing clinician.';
  const request = buildGeminiRequest('Associations are not proven causes.', prompt);
  assert(request.contents[0].parts[0].text === prompt, 'Clinical input was lost');
  assert(request.systemInstruction.parts[0].text === 'Associations are not proven causes.', 'Safety instructions were lost');
  assert(request.generationConfig.responseMimeType === 'application/json', 'Structured response required');
});

Deno.test('blocked or truncated Google responses do not become clinical reports', () => {
  assert(readGeminiText({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'partial report' }] } }] }) === '', 'Blocked report accepted');
  assert(readGeminiText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial report' }] } }] }) === '', 'Truncated report accepted');
});

Deno.test('Gemini reasoning is excluded and complete response parts are joined', () => {
  const text = readGeminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal reasoning' }, { text: '{"clinicalAnalysis":' }, { text: '"complete"}' }] } }] });
  assert(text === '{"clinicalAnalysis":"complete"}', 'Reasoning leaked or report was truncated');
});