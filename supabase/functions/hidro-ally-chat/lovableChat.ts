import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway";

export const CHAT_MODEL = 'openai/gpt-6-astra';
export const CHAT_OUTPUT_TOKENS = 8192;
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Part = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'auto' } | { type: 'input_file'; file_data: string; filename: string };
export type ChatInput = { role: 'user' | 'assistant'; content: string | Part[] };

export function buildInput(messages: ChatMessage[], attachment?: string, mime?: string, carriedOver = false): ChatInput[] {
  return messages.map((message, index) => {
    const text = message.content || 'Please read the attachment.';
    if (!(attachment && message.role === 'user' && index === messages.length - 1)) return { role: message.role, content: text };
    const detected = attachment.startsWith('data:') ? attachment.split(';')[0].slice(5) : undefined;
    const type = mime || detected || 'image/jpeg';
    const data = attachment.startsWith('data:') ? attachment : `data:${type};base64,${attachment}`;
    const file: Part = type.startsWith('image/') ? { type: 'input_image', image_url: data, detail: 'auto' } : { type: 'input_file', file_data: data, filename: 'attachment.pdf' };
    return { role: 'user', content: [file, { type: 'input_text', text: (carriedOver ? 'The attachment was shared earlier in this conversation. Refer to its contents.\n' : '') + text }] };
  });
}

type Generate = typeof generateResponse;
export async function generateChat(systemPrompt: string, input: ChatInput[], generate: Generate = generateResponse): Promise<string> {
  let reply = '';
  const history = [...input];
  for (let attempt = 0; attempt < 3; attempt++) {
    let result;
    try {
      // deno-lint-ignore no-explicit-any
      result = await generate({ model: CHAT_MODEL, instructions: systemPrompt, input: history as any, max_output_tokens: CHAT_OUTPUT_TOKENS });
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error('AI gateway error', error.code, error.httpStatus, error.ids);
        if (error.httpStatus === 429) throw new Error('HidroAlly is very busy right now. Please try again in a minute.');
        if (error.httpStatus === 402) throw new Error('HidroAlly chat is temporarily unavailable. Please try again later.');
      }
      throw new Error('HidroAlly could not complete this reply. Please try again.');
    }
    // deno-lint-ignore no-explicit-any
    const text = ((result as any).output || []).filter((item: any) => item.type === 'message').flatMap((item: any) => item.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text || '').join('');
    reply += text;
    // deno-lint-ignore no-explicit-any
    const incomplete = (result as any).incomplete_details?.reason;
    if (!incomplete) {
      if (!reply.trim()) throw new Error('HidroAlly returned no reply. Please try rephrasing your message.');
      return reply.trim();
    }
    if (incomplete !== 'max_output_tokens') throw new Error('HidroAlly could not finish this reply. Please rephrase your message.');
    history.push({ role: 'assistant', content: text }, { role: 'user', content: 'Continue exactly where your last response stopped, finishing the explanation and final sentence. Do not repeat earlier text.' });
  }
  throw new Error('This reply exceeded the response limit. Please ask about one part at a time.');
}

export function chatEventStream(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
}
