import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildInput, generateChat } from "./lovableChat.ts";

Deno.test("continues when the reply hits the token limit", async () => {
  const replies = [{ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Part one ' }] }], incomplete_details: { reason: 'max_output_tokens' } }, { output: [{ type: 'message', content: [{ type: 'output_text', text: 'part two.' }] }], incomplete_details: null }];
  // deno-lint-ignore no-explicit-any
  const text = await generateChat('sys', buildInput([{ role: 'user', content: 'hi' }]), (async () => replies.shift()) as any);
  assertEquals(text, 'Part one part two.');
});

Deno.test("sends PDFs as files and images as images", () => {
  const pdf = buildInput([{ role: 'user', content: 'read' }], 'AAAA', 'application/pdf')[0].content as { type: string }[];
  const img = buildInput([{ role: 'user', content: 'see' }], 'data:image/png;base64,AAAA')[0].content as { type: string }[];
  assertEquals(pdf[0].type, 'input_file');
  assertEquals(img[0].type, 'input_image');
});
