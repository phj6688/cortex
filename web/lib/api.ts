/**
 * NDJSON stream consumer for brief refinement.
 * @module lib/api
 */

export type BriefStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'warning'; content: string }
  | { type: 'fallback'; content: string }
  | { type: 'complete'; content: BriefCompletePayload }
  | { type: 'error'; content: string };

export interface BriefContent {
  title: string;
  objective: string;
  acceptance_criteria: string[];
  avoid_areas: string[];
  estimated_complexity?: string;
  suggested_project?: string | null;
}

export type BriefCompletePayload =
  | { type: 'questions'; content: string[] }
  | { type: 'brief'; content: BriefContent };

/**
 * Stream brief refinement via NDJSON.
 * @param input - User intent text
 * @param signal - AbortSignal for cancellation
 * @param answers - Previous answers to clarifying questions
 * @yields BriefStreamEvent objects
 */
const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

export async function* streamBriefRefinement(
  input: string,
  signal?: AbortSignal,
  answers?: string[],
): AsyncGenerator<BriefStreamEvent> {
  const res = await fetch(`${apiBase}/api/briefs/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, answers }),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `Refine failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as BriefStreamEvent;
      } catch {
        // skip malformed lines
      }
    }
  }
}
