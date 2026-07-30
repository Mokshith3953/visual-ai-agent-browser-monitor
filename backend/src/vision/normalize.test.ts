import { describe, expect, it } from 'vitest';
import { normalizeVisionInput } from './normalize';

describe('normalizeVisionInput', () => {
  it('passes through a well-formed result unchanged', () => {
    const result = normalizeVisionInput({
      app: 'GitHub',
      task: 'reviewing a pull request',
      category: 'work',
      entities: ['visual-ai-agent', 'PR #12'],
      summary: 'Reviewing a diff on GitHub.',
      containsSensitive: false,
    });
    expect(result).toEqual({
      app: 'GitHub',
      task: 'reviewing a pull request',
      category: 'work',
      entities: ['visual-ai-agent', 'PR #12'],
      summary: 'Reviewing a diff on GitHub.',
      containsSensitive: false,
    });
  });

  it('falls back to safe defaults for null/undefined input', () => {
    expect(normalizeVisionInput(null)).toEqual({
      app: 'Unknown',
      task: 'Unknown activity',
      category: 'other',
      entities: [],
      summary: '',
      containsSensitive: false,
    });
    expect(normalizeVisionInput(undefined)).toEqual({
      app: 'Unknown',
      task: 'Unknown activity',
      category: 'other',
      entities: [],
      summary: '',
      containsSensitive: false,
    });
  });

  it('rejects an invalid category and falls back to "other"', () => {
    const result = normalizeVisionInput({
      app: 'X',
      task: 'Y',
      // @ts-expect-error deliberately invalid category to test the guard
      category: 'not-a-real-category',
      entities: [],
      summary: '',
      containsSensitive: false,
    });
    expect(result.category).toBe('other');
  });

  it('caps entities at 6', () => {
    const result = normalizeVisionInput({
      entities: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    });
    expect(result.entities).toHaveLength(6);
    expect(result.entities).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('coerces a non-array entities field to an empty array', () => {
    const result = normalizeVisionInput({ entities: 'not-an-array' as unknown as string[] });
    expect(result.entities).toEqual([]);
  });

  it('coerces containsSensitive to a strict boolean', () => {
    expect(normalizeVisionInput({ containsSensitive: 1 as unknown as boolean }).containsSensitive).toBe(
      true,
    );
    expect(
      normalizeVisionInput({ containsSensitive: undefined }).containsSensitive,
    ).toBe(false);
  });

  it('treats an empty app/task string as missing and defaults it', () => {
    const result = normalizeVisionInput({ app: '', task: '' });
    expect(result.app).toBe('Unknown');
    expect(result.task).toBe('Unknown activity');
  });
});
