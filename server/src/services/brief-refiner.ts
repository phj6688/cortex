/**
 * LLM-powered brief refinement.
 * System prompt, user message builder, response parser.
 * @module services/brief-refiner
 */

import { streamMessage } from '../lib/llm.js';
import { llmResponseSchema, type LLMResponse } from '../domain/brief-schema.js';

export const SYSTEM_PROMPT = `You are a staff engineer receiving a task delegation.
Your job: produce a structured brief the executing agent can follow.

RULES:
- Ask 0–3 clarifying questions ONLY if they materially change execution.
- Frame as asking PERMISSION, not requesting specification.
  CORRECT: "Should I avoid touching the auth module?"
  INCORRECT: "What should I avoid?"
- If intent is already clear: skip questions, produce brief directly.
- Ops/infra tasks ALWAYS skip questions.
- Title: 8 words max.
- Objective: 2 sentences max.
- Acceptance criteria: measurable, testable.

OUTPUT (JSON):
{
  "questions": string[] | null,
  "brief": {
    "title": string,
    "objective": string,
    "acceptance_criteria": string[],
    "avoid_areas": string[],
    "estimated_complexity": "trivial" | "small" | "medium" | "large",
    "suggested_project": string | null
  } | null
}`;

/**
 * Build the user message from input + optional context + answers.
 * @param input - Raw user intent
 * @param context - Optional additional context
 * @param answers - Previous answers to clarifying questions
 * @returns Formatted user message
 */
export function buildUserMessage(
  input: string,
  context?: string,
  answers?: string[],
): string {
  let msg = `User intent: ${input}`;
  if (context) {
    msg += `\n\nAdditional context: ${context}`;
  }
  if (answers && answers.length > 0) {
    msg += `\n\nUser answers to previous questions:\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
  }
  return msg;
}

/**
 * Parse LLM raw text into a structured response.
 * Handles the old {questions, brief} format and the new {type, content} format.
 * @param rawText - Full LLM text output
 * @param originalInput - The original user input (fallback title)
 * @returns Parsed LLM response
 */
export function parseLLMResponse(rawText: string, originalInput: string): LLMResponse {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Handle spec format: { questions: [...] | null, brief: {...} | null }
    if ('questions' in raw || 'brief' in raw) {
      if (raw.questions && Array.isArray(raw.questions) && raw.questions.length > 0) {
        return { type: 'questions', content: raw.questions as string[] };
      }
      if (raw.brief && typeof raw.brief === 'object') {
        const parsed = llmResponseSchema.safeParse({ type: 'brief', content: raw.brief });
        if (parsed.success) return parsed.data;
      }
    }

    // Handle direct {type, content} format
    const directParsed = llmResponseSchema.safeParse(raw);
    if (directParsed.success) return directParsed.data;

    // Try wrapping as brief content
    const wrappedParsed = llmResponseSchema.safeParse({ type: 'brief', content: raw });
    if (wrappedParsed.success) return wrappedParsed.data;

    throw new Error('Could not parse LLM response');
  } catch {
    // Fallback: construct a brief from raw text
    return {
      type: 'brief',
      content: {
        title: originalInput.slice(0, 50),
        objective: rawText || originalInput,
        acceptance_criteria: [],
        avoid_areas: [],
        estimated_complexity: 'small',
        suggested_project: null,
      },
    };
  }
}

/**
 * Create a streaming refinement session.
 * @param input - User intent
 * @param context - Optional context
 * @param answers - Optional previous answers
 * @param model - LLM model to use
 * @returns Stream handle with text events and finalText
 */
export function createRefinementStream(
  input: string,
  context?: string,
  answers?: string[],
  model?: string,
) {
  const userMessage = buildUserMessage(input, context, answers);
  return streamMessage(SYSTEM_PROMPT, userMessage, model);
}
