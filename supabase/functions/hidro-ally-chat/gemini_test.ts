import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildContents, generateChat, CHAT_MODEL, CHAT_OUTPUT_TOKENS } from './gemini.ts';
Deno.test('chat uses direct Gemini and completes a token-limited reply', async () => {
  const requests: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    assert(String(url).includes(`/${CHAT_MODEL}:generateContent`));
    assert(!String(url).includes('gateway'));
    requests.push(JSON.parse(String(options?.body)));
    return Response.json({ candidates: [{ finishReason: requests.length === 1 ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text: requests.length === 1 ? 'First explanation. ' : 'Completed final sentence.' }] } }] });
  };
  assertEquals(await generateChat('synthetic-test-key', 'clinical prompt', buildContents([{ role: 'user', content: 'Explain sweating.' }]), fetcher), 'First explanation. Completed final sentence.');
  assertEquals(requests.length, 2);
  assertEquals((requests[0].generationConfig as { maxOutputTokens: number }).maxOutputTokens, CHAT_OUTPUT_TOKENS);
});
Deno.test('chat preserves image and PDF attachments with conversation history', () => {
  for (const mime of ['image/png', 'application/pdf']) {
    const contents = buildContents([{ role: 'assistant', content: 'Earlier reply' }, { role: 'user', content: 'Read this' }], `data:${mime};base64,YWJj`, mime);
    assertEquals(contents[0].role, 'model');
    assertEquals(contents[1].parts[0], { inline_data: { mime_type: mime, data: 'YWJj' } });
  }
});