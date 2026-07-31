import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import type { VisionResult } from '../types.js';
import { CATEGORIES, normalizeVisionInput } from './normalize.js';

const client = new GoogleGenAI({ apiKey: config.geminiApiKey });

/** Constrains the model to return schema-valid JSON directly (no tool-call parsing needed). */
const RESULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    app: { type: Type.STRING, description: 'The app or site in focus, e.g. GitHub, Gmail, YouTube.' },
    task: { type: Type.STRING, description: 'What the user is doing, e.g. "reading a pull request".' },
    category: { type: Type.STRING, enum: CATEGORIES as unknown as string[] },
    entities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Salient nouns: repo names, video titles, doc names (max 6).',
    },
    summary: { type: Type.STRING, description: 'One concise sentence describing the activity.' },
    containsSensitive: {
      type: Type.BOOLEAN,
      description: 'True if the screen likely shows sensitive content (financial, medical, credentials).',
    },
  },
  required: ['app', 'task', 'category', 'entities', 'summary', 'containsSensitive'],
};

const SYSTEM = [
  'You analyze a single browser screenshot and record what the user is doing.',
  'Be concise and factual. Do not transcribe sensitive data (card numbers, passwords, health details);',
  'instead set containsSensitive=true and keep the summary generic.',
  'If the screen is ambiguous, make your best reasonable inference.',
].join(' ');

export async function analyzeScreenshot(
  imageBase64: string,
  meta: { url: string | null; title: string | null },
): Promise<VisionResult> {
  const response = await client.models.generateContent({
    model: config.visionModel,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          {
            text: `Page title: ${meta.title ?? '(unknown)'}\nURL: ${meta.url ?? '(unknown)'}\nRecord the activity.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: RESULT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('vision_no_output');

  return normalizeVisionInput(JSON.parse(text) as Partial<VisionResult>);
}
