export const EPISODE_MODEL = 'gemini-2.5-flash';

export function buildGeminiRequest(system: string, prompt: string) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          emotionalSupport: { type: 'STRING' },
          clinicalAnalysis: { type: 'STRING' },
          immediateRelief: { type: 'ARRAY', items: { type: 'STRING' } },
          lifestyleModifications: { type: 'ARRAY', items: { type: 'STRING' } },
          medicalAttention: { type: 'STRING' },
        },
        required: ['emotionalSupport', 'clinicalAnalysis', 'immediateRelief', 'lifestyleModifications', 'medicalAttention'],
      },
    },
  };
}

export function readGeminiText(payload: { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] }) {
  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') return '';
  return candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('') ?? '';
}