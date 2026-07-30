import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { VisionResult } from '../types.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const CATEGORIES = [
  'work',
  'communication',
  'social',
  'entertainment',
  'shopping',
  'learning',
  'news',
  'finance',
  'other',
] as const;

/**
 * Structured output is forced via a single tool. Claude must call it, so we get
 * schema-valid JSON back rather than free-form text we'd have to parse loosely.
 */
const ACTIVITY_TOOL: Anthropic.Tool = {
  name: 'record_activity',
  description: 'Record a structured summary of what the user is doing in this screenshot.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app: { type: 'string', description: 'The app or site in focus, e.g. GitHub, Gmail, YouTube.' },
      task: { type: 'string', description: 'What the user is doing, e.g. "reading a pull request".' },
      category: { type: 'string', enum: CATEGORIES as unknown as string[] },
      entities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Salient nouns: repo names, video titles, doc names (max 6).',
      },
      summary: { type: 'string', description: 'One concise sentence describing the activity.' },
      containsSensitive: {
        type: 'boolean',
        description: 'True if the screen likely shows sensitive content (financial, medical, credentials).',
      },
    },
    required: ['app', 'task', 'category', 'entities', 'summary', 'containsSensitive'],
  },
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
  const response = await client.messages.create({
    model: config.visionModel,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [ACTIVITY_TOOL],
    tool_choice: { type: 'tool', name: 'record_activity' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: `Page title: ${meta.title ?? '(unknown)'}\nURL: ${meta.url ?? '(unknown)'}\nRecord the activity.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) throw new Error('vision_no_tool_use');

  const input = toolUse.input as Partial<VisionResult>;
  return {
    app: input.app ?? 'Unknown',
    task: input.task ?? 'Unknown activity',
    category: (input.category as VisionResult['category']) ?? 'other',
    entities: Array.isArray(input.entities) ? input.entities.slice(0, 6) : [],
    summary: input.summary ?? '',
    containsSensitive: Boolean(input.containsSensitive),
  };
}
