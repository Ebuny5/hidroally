export const CHAT_MODEL = 'gemini-2.5-flash';
export const CHAT_OUTPUT_TOKENS = 8192;
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export function buildContents(messages: ChatMessage[], attachment?: string, mime?: string, carriedOver = false) {
  return messages.map((message, index) => {
    const parts: Part[] = [];
    if (attachment && message.role === 'user' && index === messages.length - 1) {
      const detected = attachment.startsWith('data:') ? attachment.split(';')[0].slice(5) : undefined;
      parts.push({ inline_data: { mime_type: mime || detected || 'image/jpeg', data: attachment.includes(',') ? attachment.slice(attachment.indexOf(',') + 1) : attachment } });
    }
    parts.push({ text: (carriedOver && parts.length ? 'The attachment was shared earlier in this conversation. Refer to its contents.\n' : '') + (message.content || 'Please read the attachment.') });
    return { role: message.role === 'assistant' ? 'model' : 'user', parts };
  });
}

export async function generateChat(key: string, systemPrompt: string, contents: ReturnType<typeof buildContents>, fetcher: typeof fetch = fetch): Promise<string> {
  let reply = '';
  const history = [...contents];
  // Buffer complete responses so a provider's token-limit finish cannot masquerade as a completed answer.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] }, contents: history,
        generationConfig: { temperature: 0.7, maxOutputTokens: CHAT_OUTPUT_TOKENS, thinkingConfig: { thinkingBudget: 1024 } },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 429 ? 'Chat is temporarily at its Gemini usage limit. Please try again shortly.' : 'Gemini could not complete this reply. Please try again.');
    }
    const result = await response.json();
    const candidate = result.candidates?.[0];
    const text = (candidate?.content?.parts || []).filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('');
    if (!text) throw new Error('Gemini returned no reply. Please try rephrasing your message.');
    reply += text;
    if (candidate.finishReason === 'STOP') return reply.trim();
    if (candidate.finishReason !== 'MAX_TOKENS') throw new Error('Gemini could not finish this reply. Please rephrase your message.');
    history.push({ role: 'model', parts: [{ text }] }, { role: 'user', parts: [{ text: 'Continue exactly where your last response stopped, finishing the explanation and final sentence. Do not repeat earlier text.' }] });
  }
  throw new Error('This reply exceeded the response limit. Please ask about one part at a time.');
}

export function chatEventStream(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
}